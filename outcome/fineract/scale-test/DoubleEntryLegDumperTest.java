/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
package org.apache.fineract.accounting.journalentry;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.apache.fineract.accounting.closure.domain.GLClosure;
import org.apache.fineract.accounting.glaccount.domain.GLAccount;
import org.apache.fineract.accounting.journalentry.data.ChargePaymentDTO;
import org.apache.fineract.accounting.journalentry.data.LoanDTO;
import org.apache.fineract.accounting.journalentry.data.LoanTransactionDTO;
import org.apache.fineract.accounting.journalentry.service.AccountingProcessorForLoan;
import org.apache.fineract.accounting.journalentry.service.AccountingProcessorHelper;
import org.apache.fineract.accounting.journalentry.service.AccrualBasedAccountingProcessorForLoan;
import org.apache.fineract.accounting.journalentry.service.CashBasedAccountingProcessorForLoan;
import org.apache.fineract.accounting.journalentry.service.JournalAmountHolder;
import org.apache.fineract.organisation.office.domain.Office;
import org.apache.fineract.portfolio.loanaccount.data.LoanTransactionEnumData;
import org.junit.jupiter.api.Test;
import org.mockito.invocation.InvocationOnMock;

/**
 * Trace dumper for the loan-accounting posting legs. Same fixtures and same mock-helper interception as the
 * double-entry oracle, but instead of asserting balance it records each posting leg (account, side, amount) in
 * emission order and writes one trace file per (fixture, transaction) pair.
 *
 * <p>
 * Output directory is taken from the system property {@code je.trace.dir}. Each line of a trace file is:
 *
 * <pre>
 * period=&lt;row&gt; account=&lt;accountName&gt; debit=&lt;amount&gt; credit=&lt;amount&gt;
 * </pre>
 *
 * A debit leg has the amount in {@code debit=} and {@code credit=0.00}; a credit leg is the mirror. The paired
 * primitives emit two rows (a debit then a credit of the same amount). Nothing is balanced or adjusted; the numbers
 * are exactly what the processor handed the helper.
 */
class DoubleEntryLegDumperTest {

    private static final Long LOAN_ID = 1L;
    private static final Long PRODUCT_ID = 1L;
    private static final Long OFFICE_ID = 1L;
    private static final String CCY = "USD";
    private static final LocalDate DATE = LocalDate.of(2024, 1, 15);

    private static final Path OUT_DIR = Paths.get(System.getProperty("je.trace.dir", "je-traces"));

    // ----------------------------------------------------------------------------------------------------------------
    // Trace infrastructure: an ordered list of posting legs, keyed by transaction id, in emission order.
    // ----------------------------------------------------------------------------------------------------------------

    private enum Side {
        DEBIT, CREDIT
    }

    private record Leg(String txnId, String account, Side side, BigDecimal amount) {
    }

    private static final class Recorder {

        // Insertion-ordered: legs are appended exactly as the processor emits them.
        final List<Leg> legs = new ArrayList<>();

        void add(String txnId, String account, Side side, BigDecimal amount) {
            if (amount == null) {
                return;
            }
            legs.add(new Leg(txnId, account, side, amount));
        }

        // Distinct transaction ids in first-seen order.
        List<String> transactionIds() {
            List<String> ids = new ArrayList<>();
            for (Leg l : legs) {
                String key = l.txnId() == null ? "<null>" : l.txnId();
                if (!ids.contains(key)) {
                    ids.add(key);
                }
            }
            return ids;
        }

        List<Leg> legsFor(String id) {
            List<Leg> out = new ArrayList<>();
            for (Leg l : legs) {
                String key = l.txnId() == null ? "<null>" : l.txnId();
                if (key.equals(id)) {
                    out.add(l);
                }
            }
            return out;
        }
    }

    /**
     * Pull the transaction id out of a posting invocation: the one String argument that is not the currency code.
     */
    private static String txnIdOf(InvocationOnMock inv) {
        String candidate = null;
        for (Object arg : inv.getArguments()) {
            if (arg instanceof String s && !CCY.equals(s)) {
                candidate = s;
            }
        }
        return candidate;
    }

    private static BigDecimal amountOf(InvocationOnMock inv) {
        BigDecimal amount = null;
        for (Object arg : inv.getArguments()) {
            if (arg instanceof BigDecimal b) {
                amount = b;
            }
        }
        return amount;
    }

    /**
     * Best-effort account name for a posting invocation, faithful to whatever identity the processor used. Priority:
     * an explicit {@link GLAccount} argument's name; else a mapping-type Integer argument rendered as {@code GL-<n>}
     * (matching the stubbed GL accounts); else an accounts enum argument's name; else {@code <unknown>}.
     */
    private static String accountOf(InvocationOnMock inv) {
        for (Object arg : inv.getArguments()) {
            if (arg instanceof GLAccount gl) {
                return gl.getName() != null ? gl.getName() : ("GL-id-" + gl.getId());
            }
        }
        for (Object arg : inv.getArguments()) {
            if (arg instanceof org.apache.fineract.accounting.common.AccountingConstants.CashAccountsForLoan e) {
                return "GL-" + e.getValue();
            }
            if (arg instanceof org.apache.fineract.accounting.common.AccountingConstants.AccrualAccountsForLoan e) {
                return "GL-" + e.getValue();
            }
        }
        for (Object arg : inv.getArguments()) {
            if (arg instanceof Integer i) {
                return "GL-" + i;
            }
        }
        return "<unknown>";
    }

    /**
     * Default answer for the mocked helper. All the shipped helper methods the tests intercept are wired explicitly
     * below; this only matters for methods some edited version adds and calls but that we do not name at compile time
     * (so the test compiles against every version). The t3 edit adds {@code roundRepaymentInterest(BigDecimal)} and
     * calls it on the repayment path; the real body rounds HALF_EVEN to 2 dp. We reproduce exactly that here, keyed by
     * method name, so the dumped legs are what the real edited processor emits rather than a null-driven crash. Every
     * other method falls through to Mockito's normal defaults.
     */
    private static final org.mockito.stubbing.Answer<Object> HELPER_DEFAULT = inv -> {
        String name = inv.getMethod().getName();
        if ("roundRepaymentInterest".equals(name)) {
            for (Object arg : inv.getArguments()) {
                if (arg instanceof BigDecimal b) {
                    return b == null ? null : b.setScale(2, RoundingMode.HALF_EVEN);
                }
            }
            return null;
        }
        return org.mockito.Answers.RETURNS_DEFAULTS.answer(inv);
    };

    private AccountingProcessorHelper mockHelper(Recorder rec) {
        AccountingProcessorHelper helper = mock(AccountingProcessorHelper.class, HELPER_DEFAULT);

        Office office = Office.headOffice("Head Office", DATE, null);
        lenient().when(helper.getOfficeById(anyLong())).thenReturn(office);
        lenient().when(helper.getLatestClosureByBranch(anyLong())).thenReturn(mock(GLClosure.class));

        lenient().when(helper.getLinkedGLAccountForLoanProduct(any(), anyInt(), any())).thenAnswer(inv -> {
            Integer accountType = inv.getArgument(1);
            GLAccount account = new GLAccount();
            account.setId(1000L + accountType);
            account.setName("GL-" + accountType);
            account.setGlCode("GL-" + accountType);
            return account;
        });

        installDebit(helper, rec);
        installCredit(helper, rec);
        installPaired(helper, rec);

        return helper;
    }

    private void installDebit(AccountingProcessorHelper helper, Recorder rec) {
        org.mockito.stubbing.Answer<Void> debit = inv -> {
            rec.add(txnIdOf(inv), accountOf(inv), Side.DEBIT, amountOf(inv));
            return null;
        };
        lenient().doAnswer(debit).when(helper).createDebitJournalEntryForLoan(any(), anyString(), anyInt(), any(), any(), any(), anyString(),
                any(), any());
        lenient().doAnswer(debit).when(helper).createDebitJournalEntryForLoan(any(), anyString(), any(GLAccount.class), any(), anyString(),
                any(), any());
        lenient().doAnswer(debit).when(helper).createDebitJournalEntryForLoan(any(), anyString(), any(), anyString(), any(), any(),
                any(GLAccount.class));
        lenient().doAnswer(debit).when(helper).createDebitJournalEntryForLoanByGLAccountId(any(), anyString(), any(), anyString(), any(),
                any(), any());
        lenient().doAnswer(debit).when(helper).createDebitJournalEntryForLoanCharges(any(), anyString(), anyInt(), any(), anyLong(), any(),
                anyString(), any(), any());
        lenient().doAnswer(debit).when(helper).createDebitJournalEntryForLoanCharges(any(), anyString(), anyInt(), any(), any(),
                anyString(), any(), any(), any());
    }

    private void installCredit(AccountingProcessorHelper helper, Recorder rec) {
        org.mockito.stubbing.Answer<Void> credit = inv -> {
            rec.add(txnIdOf(inv), accountOf(inv), Side.CREDIT, amountOf(inv));
            return null;
        };
        lenient().doAnswer(credit).when(helper).createCreditJournalEntryForLoan(any(), anyString(), anyInt(), any(), any(), any(),
                anyString(), any(), any());
        lenient().doAnswer(credit).when(helper).createCreditJournalEntryForLoan(any(), anyString(),
                any(org.apache.fineract.accounting.common.AccountingConstants.CashAccountsForLoan.class), any(), any(), any(), anyString(),
                any(), any());
        lenient().doAnswer(credit).when(helper).createCreditJournalEntryForLoan(any(), anyString(),
                any(org.apache.fineract.accounting.common.AccountingConstants.AccrualAccountsForLoan.class), any(), any(), any(),
                anyString(), any(), any());
        lenient().doAnswer(credit).when(helper).createCreditJournalEntryForLoan(any(), anyString(), any(), anyString(), any(), any(),
                any(GLAccount.class));
        lenient().doAnswer(credit).when(helper).createCreditJournalEntryForLoanByGLAccountId(any(), anyString(), any(), anyString(), any(),
                any(), any());
        lenient().doAnswer(credit).when(helper).createCreditJournalEntryForLoanCharges(any(), anyString(), anyInt(), any(), any(),
                anyString(), any(), any(), any());
    }

    private void installPaired(AccountingProcessorHelper helper, Recorder rec) {
        org.mockito.stubbing.Answer<Void> paired = inv -> {
            String id = txnIdOf(inv);
            BigDecimal amount = amountOf(inv);
            String account = accountOf(inv);
            rec.add(id, account, Side.DEBIT, amount);
            rec.add(id, account, Side.CREDIT, amount);
            return null;
        };
        lenient().doAnswer(paired).when(helper).createJournalEntriesForLoan(any(), anyString(), any(Integer.class), any(Integer.class),
                any(), any(), any(), anyString(), any(), any());
        lenient().doAnswer(paired).when(helper).createJournalEntriesForLoan(any(), anyString(), any(Integer.class), any(GLAccount.class),
                any(), any(), any(), anyString(), any(), any());
        lenient().doAnswer(paired).when(helper).createJournalEntriesForLoanCharges(any(), anyString(), any(Integer.class),
                any(Integer.class), any(), any(), anyString(), any(), any(), any());

        lenient().doAnswer(inv -> {
            @SuppressWarnings("unchecked")
            List<JournalAmountHolder> splits = (List<JournalAmountHolder>) inv.getArgument(2);
            JournalAmountHolder total = inv.getArgument(3);
            String id = (String) inv.getArgument(6);
            for (JournalAmountHolder split : splits) {
                if (isGreaterThanZero(split.getAmount())) {
                    rec.add(id, "split:" + safeName(split), Side.DEBIT, split.getAmount());
                }
            }
            if (isGreaterThanZero(total.getAmount())) {
                rec.add(id, "split-total:" + safeName(total), Side.CREDIT, total.getAmount());
            }
            return null;
        }).when(helper).createSplitJournalEntriesForLoan(any(), anyString(), any(), any(), any(), any(), any(), anyString(), any());
    }

    private static String safeName(JournalAmountHolder h) {
        try {
            Object acct = h.getClass().getMethod("getGlAccount").invoke(h);
            if (acct instanceof GLAccount gl && gl.getName() != null) {
                return gl.getName();
            }
        } catch (ReflectiveOperationException ignored) {
            // fall through
        }
        return "<holder>";
    }

    private static boolean isGreaterThanZero(BigDecimal v) {
        return v != null && v.compareTo(BigDecimal.ZERO) > 0;
    }

    // ----------------------------------------------------------------------------------------------------------------
    // Trace writing.
    // ----------------------------------------------------------------------------------------------------------------

    private void dump(String fixtureName, Recorder rec) throws IOException {
        Files.createDirectories(OUT_DIR);
        for (String id : rec.transactionIds()) {
            List<Leg> legs = rec.legsFor(id);
            StringBuilder sb = new StringBuilder();
            int period = 0;
            for (Leg leg : legs) {
                // Faithful to the amount the processor handed the helper: shown at its natural scale but never fewer
                // than 2 dp. We do NOT re-round here, so a sub-cent amount a processor emits (e.g. an unrounded
                // interest leg) is visible rather than masked by a display rounding.
                BigDecimal amt = leg.amount();
                if (amt.scale() < 2) {
                    amt = amt.setScale(2, RoundingMode.UNNECESSARY);
                }
                BigDecimal debit = leg.side() == Side.DEBIT ? amt : new BigDecimal("0.00");
                BigDecimal credit = leg.side() == Side.CREDIT ? amt : new BigDecimal("0.00");
                sb.append("period=").append(period).append(" account=").append(leg.account()).append(" debit=").append(debit)
                        .append(" credit=").append(credit).append('\n');
                period++;
            }
            Path file = OUT_DIR.resolve(sanitise(fixtureName) + "__" + sanitise(id) + ".trace");
            Files.writeString(file, sb.toString(), StandardCharsets.UTF_8);
        }
    }

    private static String sanitise(String s) {
        return (s == null ? "null" : s).replaceAll("[^A-Za-z0-9._-]", "-");
    }

    // ----------------------------------------------------------------------------------------------------------------
    // Fixture construction. Identical to the oracle's.
    // ----------------------------------------------------------------------------------------------------------------

    private LoanTransactionEnumData txnType() {
        return mock(LoanTransactionEnumData.class);
    }

    private LoanTransactionDTO txn(String txnId, LoanTransactionEnumData type, BigDecimal amount, BigDecimal principal, BigDecimal interest,
            BigDecimal fees, BigDecimal penalties, BigDecimal overpayment, List<ChargePaymentDTO> feePayments,
            List<ChargePaymentDTO> penaltyPayments) {
        LoanTransactionDTO dto = new LoanTransactionDTO(OFFICE_ID, null, txnId, DATE, type, amount, principal, interest, fees, penalties,
                overpayment, false, penaltyPayments == null ? Collections.emptyList() : penaltyPayments,
                feePayments == null ? Collections.emptyList() : feePayments, false, "", null, null, null, null);
        dto.setChargeTaxPayments(Collections.emptyList());
        return dto;
    }

    private LoanDTO loan(boolean cash, boolean chargeOff, boolean fraud, Long chargeOffReasonId, LoanTransactionDTO... txns) {
        boolean upfrontAccrual = !cash;
        return new LoanDTO(LOAN_ID, PRODUCT_ID, OFFICE_ID, CCY, cash, upfrontAccrual, upfrontAccrual, List.of(txns), chargeOff, fraud,
                chargeOffReasonId, false, false, null, null, null);
    }

    private Recorder runCash(LoanDTO loanDTO) {
        Recorder rec = new Recorder();
        AccountingProcessorHelper helper = mockHelper(rec);
        AccountingProcessorForLoan processor = new CashBasedAccountingProcessorForLoan(helper,
                mock(org.apache.fineract.accounting.journalentry.service.JournalEntryWritePlatformService.class),
                new org.apache.fineract.accounting.journalentry.service.LoanCommonAccountingHelper(helper));
        processor.createJournalEntriesForLoan(loanDTO);
        return rec;
    }

    private Recorder runAccrual(LoanDTO loanDTO) {
        Recorder rec = new Recorder();
        AccountingProcessorHelper helper = mockHelper(rec);
        AccountingProcessorForLoan processor = new AccrualBasedAccountingProcessorForLoan(helper,
                mock(org.apache.fineract.accounting.journalentry.service.JournalEntryWritePlatformService.class),
                new org.apache.fineract.accounting.journalentry.service.LoanCommonAccountingHelper(helper));
        processor.createJournalEntriesForLoan(loanDTO);
        return rec;
    }

    private static List<ChargePaymentDTO> onePayment(BigDecimal amount) {
        List<ChargePaymentDTO> list = new ArrayList<>();
        list.add(new ChargePaymentDTO(1L, amount, 1L));
        return list;
    }

    // ----------------------------------------------------------------------------------------------------------------
    // The battery. One @Test per fixture; each dumps its trace file(s).
    // ----------------------------------------------------------------------------------------------------------------

    @Test
    void cashRepayment() throws IOException {
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isRepaymentType()).thenReturn(true);
        LoanTransactionDTO t = txn("cash-repay", type, new BigDecimal("340.00"), new BigDecimal("200.00"), new BigDecimal("100.00"),
                new BigDecimal("25.00"), new BigDecimal("15.00"), null, onePayment(new BigDecimal("25.00")),
                onePayment(new BigDecimal("15.00")));
        dump("cash repayment (principal+interest+fees+penalties)", runCash(loan(true, false, false, null, t)));
    }

    @Test
    void cashRepaymentSubCentInterest() throws IOException {
        // Interest with sub-cent precision. Baseline posts it raw; the t3 edit rounds the interest leg HALF_EVEN to
        // 2 dp. This is the fixture on which baseline and t3 diverge.
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isRepaymentType()).thenReturn(true);
        LoanTransactionDTO t = txn("cash-repay-subcent", type, new BigDecimal("300.005"), new BigDecimal("200.00"),
                new BigDecimal("100.005"), null, null, null, null, null);
        dump("cash repayment (sub-cent interest)", runCash(loan(true, false, false, null, t)));
    }

    @Test
    void accrualRepaymentSubCentInterest() throws IOException {
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isRepaymentType()).thenReturn(true);
        LoanTransactionDTO t = txn("accr-repay-subcent", type, new BigDecimal("300.005"), new BigDecimal("200.00"),
                new BigDecimal("100.005"), null, null, null, null, null);
        dump("accrual repayment (sub-cent interest)", runAccrual(loan(false, false, false, null, t)));
    }

    @Test
    void cashDisbursement() throws IOException {
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isDisbursement()).thenReturn(true);
        LoanTransactionDTO t = txn("cash-disb", type, new BigDecimal("1000.00"), null, null, null, null, new BigDecimal("0.00"), null, null);
        dump("cash disbursement", runCash(loan(true, false, false, null, t)));
    }

    @Test
    void cashWriteOff() throws IOException {
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isWriteOff()).thenReturn(true);
        LoanTransactionDTO t = txn("cash-writeoff", type, new BigDecimal("500.00"), new BigDecimal("500.00"), null, null, null, null, null,
                null);
        dump("cash write-off (principal)", runCash(loan(true, false, false, null, t)));
    }

    @Test
    void cashRefundOfOverpayment() throws IOException {
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isRefund()).thenReturn(true);
        LoanTransactionDTO t = txn("cash-refund", type, new BigDecimal("75.00"), null, null, null, null, null, null, null);
        dump("cash refund of overpayment", runCash(loan(true, false, false, null, t)));
    }

    @Test
    void cashChargeOffRepayment() throws IOException {
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isRepaymentType()).thenReturn(true);
        Recorder rec = new Recorder();
        AccountingProcessorHelper helper = mockHelper(rec);
        new AccountingProcessorHelperStubForChargeOff().installGlAccounts(helper);
        LoanTransactionDTO t = txn("cash-chargeoff-repay", type, new BigDecimal("340.00"), new BigDecimal("200.00"),
                new BigDecimal("100.00"), new BigDecimal("25.00"), new BigDecimal("15.00"), null, onePayment(new BigDecimal("25.00")),
                onePayment(new BigDecimal("15.00")));
        AccountingProcessorForLoan processor = new CashBasedAccountingProcessorForLoan(helper,
                mock(org.apache.fineract.accounting.journalentry.service.JournalEntryWritePlatformService.class),
                new org.apache.fineract.accounting.journalentry.service.LoanCommonAccountingHelper(helper));
        processor.createJournalEntriesForLoan(loan(true, true, false, null, t));
        dump("cash charge-off repayment", rec);
    }

    @Test
    void cashTransferInitiation() throws IOException {
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isInitiateTransfer()).thenReturn(true);
        LoanTransactionDTO t = txn("cash-transfer", type, new BigDecimal("600.00"), new BigDecimal("500.00"), null, null, null, null, null,
                null);
        dump("cash transfer initiation", runCash(loan(true, false, false, null, t)));
    }

    @Test
    void accrualRepayment() throws IOException {
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isRepaymentType()).thenReturn(true);
        LoanTransactionDTO t = txn("accr-repay", type, new BigDecimal("340.00"), new BigDecimal("200.00"), new BigDecimal("100.00"),
                new BigDecimal("25.00"), new BigDecimal("15.00"), null, onePayment(new BigDecimal("25.00")),
                onePayment(new BigDecimal("15.00")));
        dump("accrual repayment (principal+interest+fees+penalties)", runAccrual(loan(false, false, false, null, t)));
    }

    @Test
    void accrualDisbursement() throws IOException {
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isDisbursement()).thenReturn(true);
        LoanTransactionDTO t = txn("accr-disb", type, new BigDecimal("1000.00"), null, null, null, null, new BigDecimal("0.00"), null, null);
        dump("accrual disbursement", runAccrual(loan(false, false, false, null, t)));
    }

    @Test
    void accrualWriteOff() throws IOException {
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isWriteOff()).thenReturn(true);
        LoanTransactionDTO t = txn("accr-writeoff", type, new BigDecimal("500.00"), new BigDecimal("500.00"), new BigDecimal("50.00"),
                new BigDecimal("10.00"), new BigDecimal("5.00"), null, null, null);
        dump("accrual write-off (all portions)", runAccrual(loan(false, false, false, null, t)));
    }

    @Test
    void accrualTransferApproval() throws IOException {
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isApproveTransfer()).thenReturn(true);
        LoanTransactionDTO t = txn("accr-transfer", type, new BigDecimal("600.00"), new BigDecimal("500.00"), null, null, null, null, null,
                null);
        dump("accrual transfer approval", runAccrual(loan(false, false, false, null, t)));
    }

    @Test
    void accrualChargeOff() throws IOException {
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isChargeoff()).thenReturn(true);
        Recorder rec = new Recorder();
        AccountingProcessorHelper helper = mockHelper(rec);
        new AccountingProcessorHelperStubForChargeOff().installGlAccounts(helper);
        lenient().when(helper.getChargeOffMappingByCodeValue(any(), any(), any())).thenReturn(null);
        LoanTransactionDTO t = txn("accr-chargeoff", type, new BigDecimal("340.00"), new BigDecimal("200.00"), new BigDecimal("100.00"),
                new BigDecimal("25.00"), new BigDecimal("15.00"), null, null, null);
        new AccountingProcessorHelperStubForChargeOff().installGlAccounts(helper);
        AccountingProcessorForLoan processor = new AccrualBasedAccountingProcessorForLoan(helper,
                mock(org.apache.fineract.accounting.journalentry.service.JournalEntryWritePlatformService.class),
                new org.apache.fineract.accounting.journalentry.service.LoanCommonAccountingHelper(helper));
        processor.createJournalEntriesForLoan(loan(false, true, false, 15L, t));
        dump("accrual charge-off", rec);
    }

    @Test
    void multiTransactionLoan() throws IOException {
        LoanTransactionEnumData disb = txnType();
        lenient().when(disb.isDisbursement()).thenReturn(true);
        LoanTransactionEnumData repay = txnType();
        lenient().when(repay.isRepaymentType()).thenReturn(true);
        LoanTransactionDTO t1 = txn("multi-disb", disb, new BigDecimal("1000.00"), null, null, null, null, new BigDecimal("0.00"), null,
                null);
        LoanTransactionDTO t2 = txn("multi-repay", repay, new BigDecimal("315.00"), new BigDecimal("200.00"), new BigDecimal("100.00"),
                new BigDecimal("15.00"), null, null, onePayment(new BigDecimal("15.00")), null);
        dump("multi-transaction loan", runCash(loan(true, false, false, null, t1, t2)));
    }

    private static final class AccountingProcessorHelperStubForChargeOff {

        void installGlAccounts(AccountingProcessorHelper helper) {
            org.apache.fineract.accounting.producttoaccountmapping.domain.ProductToGLAccountMapping mapping = new org.apache.fineract.accounting.producttoaccountmapping.domain.ProductToGLAccountMapping();
            GLAccount chargeOff = new GLAccount();
            chargeOff.setId(9999L);
            chargeOff.setName("Charge-Off");
            chargeOff.setGlCode("CO");
            mapping.setGlAccount(chargeOff);
            lenient().when(helper.getChargeOffMappingByCodeValue(any(), any(), any())).thenReturn(mapping);
        }
    }
}
