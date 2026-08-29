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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
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
 * Deterministic unit-level oracle for the first law of double-entry bookkeeping on Fineract's loan accounting path.
 *
 * <p>
 * For every loan transaction a processor turns into accounting, the sum of the DEBIT amounts it emits must equal the sum
 * of the CREDIT amounts it emits, per transaction, in the transaction currency. This law is external to the code: a
 * posted transaction that does not balance is a corrupt ledger, whatever the code intends. It is NOT enforced anywhere
 * on the loan-generated posting path (only the manual journal-entry REST path is guarded), so it can silently break.
 *
 * <p>
 * The oracle mocks {@link AccountingProcessorHelper} (exactly as the shipped processor unit tests do) and installs an
 * {@link org.mockito.stubbing.Answer} on every posting primitive the loan processors call. Each single-sided
 * {@code createDebitJournalEntryForLoan*} call adds its amount to that transaction's DEBIT tally; each single-sided
 * {@code createCreditJournalEntryForLoan*} call adds to the CREDIT tally; each paired
 * {@code createJournalEntriesForLoan(...)} / {@code createJournalEntriesForLoanCharges(...)} call adds to BOTH (it is
 * inherently balanced); {@code createSplitJournalEntriesForLoan(...)} is replicated leg-for-leg (the several debits and
 * the one credit, each posted only when {@code > 0}). After
 * {@link AccountingProcessorForLoan#createJournalEntriesForLoan(LoanDTO)}, every transaction's two tallies must be equal.
 *
 * <p>
 * Scope, stated honestly: the oracle grades the processor's emitted debit/credit arithmetic, not the JDBC persistence.
 * That is the altitude at which a blind edit to a processor leg breaks the balance.
 */
class DoubleEntryBalanceOracleTest {

    private static final Long LOAN_ID = 1L;
    private static final Long PRODUCT_ID = 1L;
    private static final Long OFFICE_ID = 1L;
    private static final String CCY = "USD";
    private static final LocalDate DATE = LocalDate.of(2024, 1, 15);

    // ----------------------------------------------------------------------------------------------------------------
    // Tally infrastructure: a mock helper that accumulates emitted debit/credit amounts per transaction id.
    // ----------------------------------------------------------------------------------------------------------------

    private static final class Tally {

        final Map<String, BigDecimal> debit = new LinkedHashMap<>();
        final Map<String, BigDecimal> credit = new LinkedHashMap<>();

        void addDebit(String txnId, BigDecimal amount) {
            if (amount == null) {
                return;
            }
            debit.merge(key(txnId), amount, BigDecimal::add);
        }

        void addCredit(String txnId, BigDecimal amount) {
            if (amount == null) {
                return;
            }
            credit.merge(key(txnId), amount, BigDecimal::add);
        }

        private static String key(String txnId) {
            return txnId == null ? "<null>" : txnId;
        }

        java.util.Set<String> transactionIds() {
            java.util.LinkedHashSet<String> ids = new java.util.LinkedHashSet<>();
            ids.addAll(debit.keySet());
            ids.addAll(credit.keySet());
            return ids;
        }

        BigDecimal debitOf(String id) {
            return debit.getOrDefault(id, BigDecimal.ZERO);
        }

        BigDecimal creditOf(String id) {
            return credit.getOrDefault(id, BigDecimal.ZERO);
        }
    }

    /**
     * Pull the transaction id (a String argument) and a BigDecimal argument out of a posting invocation. Every loan
     * posting primitive carries exactly one String currency code and one String transaction id, plus one BigDecimal
     * amount (charge overloads carry the total as their single BigDecimal). We take the currency-code String as the
     * one equal to {@link #CCY} and the transaction id as the other String; the amount as the sole BigDecimal.
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
                amount = b; // the posting primitives carry a single BigDecimal (the amount / total)
            }
        }
        return amount;
    }

    private AccountingProcessorHelper mockHelper(Tally tally) {
        AccountingProcessorHelper helper = mock(AccountingProcessorHelper.class);

        // office + closure lookups used by every transaction in the dispatch loop
        Office office = Office.headOffice("Head Office", DATE, null);
        lenient().when(helper.getOfficeById(anyLong())).thenReturn(office);
        lenient().when(helper.getLatestClosureByBranch(anyLong())).thenReturn(mock(GLClosure.class));

        // GL-account lookups: return a distinct, non-null GLAccount per account type. Several paths (write-off,
        // charge-off) key balance maps by the returned account, so null or colliding accounts would silently merge
        // legs; a stable distinct id per account type keeps each leg separate.
        lenient().when(helper.getLinkedGLAccountForLoanProduct(any(), anyInt(), any())).thenAnswer(inv -> {
            Integer accountType = inv.getArgument(1);
            GLAccount account = new GLAccount();
            account.setId(1000L + accountType);
            account.setName("GL-" + accountType);
            account.setGlCode("GL-" + accountType);
            return account;
        });

        // Every single-sided DEBIT primitive -> DEBIT tally.
        installDebit(helper, tally);
        // Every single-sided CREDIT primitive -> CREDIT tally.
        installCredit(helper, tally);
        // Paired primitives -> both tallies.
        installPaired(helper, tally);

        return helper;
    }

    private void installDebit(AccountingProcessorHelper helper, Tally tally) {
        org.mockito.stubbing.Answer<Void> debit = inv -> {
            tally.addDebit(txnIdOf(inv), amountOf(inv));
            return null;
        };
        // createDebitJournalEntryForLoan(office, ccy, int accountMappingTypeId, productId, paymentTypeId, loanId, txnId, date, amount)
        lenient().doAnswer(debit).when(helper).createDebitJournalEntryForLoan(any(), anyString(), anyInt(), any(), any(), any(), anyString(),
                any(), any());
        // createDebitJournalEntryForLoan(office, ccy, GLAccount, loanId, txnId, date, amount)
        lenient().doAnswer(debit).when(helper).createDebitJournalEntryForLoan(any(), anyString(), any(GLAccount.class), any(), anyString(),
                any(), any());
        // createDebitJournalEntryForLoan(office, ccy, loanId, txnId, date, amount, GLAccount)
        lenient().doAnswer(debit).when(helper).createDebitJournalEntryForLoan(any(), anyString(), any(), anyString(), any(), any(),
                any(GLAccount.class));
        // createDebitJournalEntryForLoanByGLAccountId(office, ccy, loanId, txnId, date, amount, glAccountId)
        lenient().doAnswer(debit).when(helper).createDebitJournalEntryForLoanByGLAccountId(any(), anyString(), any(), anyString(), any(),
                any(), any());
        // createDebitJournalEntryForLoanCharges(office, ccy, int, productId, chargeId, loanId, txnId, date, amount)
        lenient().doAnswer(debit).when(helper).createDebitJournalEntryForLoanCharges(any(), anyString(), anyInt(), any(), anyLong(), any(),
                anyString(), any(), any());
        // createDebitJournalEntryForLoanCharges(office, ccy, int, productId, loanId, txnId, date, totalAmount, List) -> single-sided debit
        lenient().doAnswer(debit).when(helper).createDebitJournalEntryForLoanCharges(any(), anyString(), anyInt(), any(), any(),
                anyString(), any(), any(), any());
    }

    private void installCredit(AccountingProcessorHelper helper, Tally tally) {
        org.mockito.stubbing.Answer<Void> credit = inv -> {
            tally.addCredit(txnIdOf(inv), amountOf(inv));
            return null;
        };
        // createCreditJournalEntryForLoan(office, ccy, int accountMappingTypeId, productId, paymentTypeId, loanId, txnId, date, amount)
        lenient().doAnswer(credit).when(helper).createCreditJournalEntryForLoan(any(), anyString(), anyInt(), any(), any(), any(),
                anyString(), any(), any());
        // createCreditJournalEntryForLoan(office, ccy, CashAccountsForLoan, productId, paymentTypeId, loanId, txnId, date, amount)
        lenient().doAnswer(credit).when(helper).createCreditJournalEntryForLoan(any(), anyString(),
                any(org.apache.fineract.accounting.common.AccountingConstants.CashAccountsForLoan.class), any(), any(), any(), anyString(),
                any(), any());
        // createCreditJournalEntryForLoan(office, ccy, AccrualAccountsForLoan, productId, paymentTypeId, loanId, txnId, date, amount)
        lenient().doAnswer(credit).when(helper).createCreditJournalEntryForLoan(any(), anyString(),
                any(org.apache.fineract.accounting.common.AccountingConstants.AccrualAccountsForLoan.class), any(), any(), any(),
                anyString(), any(), any());
        // NB: createCreditJournalEntryForLoan(office, ccy, GLAccount, loanId, txnId, date, amount) is private in the
        // helper and never reached from a processor; the processors use the (loanId, ..., GLAccount) public overload below.
        // createCreditJournalEntryForLoan(office, ccy, loanId, txnId, date, amount, GLAccount)
        lenient().doAnswer(credit).when(helper).createCreditJournalEntryForLoan(any(), anyString(), any(), anyString(), any(), any(),
                any(GLAccount.class));
        // createCreditJournalEntryForLoanByGLAccountId(office, ccy, loanId, txnId, date, amount, glAccountId)
        lenient().doAnswer(credit).when(helper).createCreditJournalEntryForLoanByGLAccountId(any(), anyString(), any(), anyString(), any(),
                any(), any());
        // createCreditJournalEntryForLoanCharges(office, ccy, int, productId, loanId, txnId, date, totalAmount, List) -> single-sided credit
        lenient().doAnswer(credit).when(helper).createCreditJournalEntryForLoanCharges(any(), anyString(), anyInt(), any(), any(),
                anyString(), any(), any(), any());
    }

    private void installPaired(AccountingProcessorHelper helper, Tally tally) {
        org.mockito.stubbing.Answer<Void> paired = inv -> {
            String id = txnIdOf(inv);
            BigDecimal amount = amountOf(inv);
            tally.addDebit(id, amount);
            tally.addCredit(id, amount);
            return null;
        };
        // createJournalEntriesForLoan(office, ccy, Integer debit, Integer credit, productId, paymentTypeId, loanId, txnId, date, amount)
        lenient().doAnswer(paired).when(helper).createJournalEntriesForLoan(any(), anyString(), any(Integer.class), any(Integer.class),
                any(), any(), any(), anyString(), any(), any());
        // createJournalEntriesForLoan(office, ccy, Integer debit, GLAccount credit, productId, paymentTypeId, loanId, txnId, date, amount)
        lenient().doAnswer(paired).when(helper).createJournalEntriesForLoan(any(), anyString(), any(Integer.class), any(GLAccount.class),
                any(), any(), any(), anyString(), any(), any());
        // createJournalEntriesForLoanCharges(office, ccy, Integer debit, Integer credit, productId, loanId, txnId, date, total, List)
        lenient().doAnswer(paired).when(helper).createJournalEntriesForLoanCharges(any(), anyString(), any(Integer.class),
                any(Integer.class), any(), any(), anyString(), any(), any(), any());

        // createSplitJournalEntriesForLoan(office, ccy, List<JournalAmountHolder> splits, JournalAmountHolder total, ...):
        // several debits (each split holder, when > 0) and one credit (the total holder, when > 0). Replicated leg-for-leg.
        lenient().doAnswer(inv -> {
            @SuppressWarnings("unchecked")
            List<JournalAmountHolder> splits = (List<JournalAmountHolder>) inv.getArgument(2);
            JournalAmountHolder total = inv.getArgument(3);
            String id = (String) inv.getArgument(6);
            for (JournalAmountHolder split : splits) {
                if (isGreaterThanZero(split.getAmount())) {
                    tally.addDebit(id, split.getAmount());
                }
            }
            if (isGreaterThanZero(total.getAmount())) {
                tally.addCredit(id, total.getAmount());
            }
            return null;
        }).when(helper).createSplitJournalEntriesForLoan(any(), anyString(), any(), any(), any(), any(), any(), anyString(), any());
    }

    private static boolean isGreaterThanZero(BigDecimal v) {
        return v != null && v.compareTo(BigDecimal.ZERO) > 0;
    }

    // ----------------------------------------------------------------------------------------------------------------
    // The check.
    // ----------------------------------------------------------------------------------------------------------------

    private void assertBalanced(String fixtureName, Tally tally) {
        assertFalse(tally.transactionIds().isEmpty(),
                "Fixture '" + fixtureName + "' emitted no journal entries at all; the oracle would vacuously pass. "
                        + "The fixture is not exercising a posting path.");
        for (String id : tally.transactionIds()) {
            BigDecimal debits = tally.debitOf(id);
            BigDecimal credits = tally.creditOf(id);
            assertEquals(0, debits.compareTo(credits),
                    "DOUBLE-ENTRY VIOLATION in fixture '" + fixtureName + "', transaction '" + id + "': sum of debits (" + debits
                            + ") != sum of credits (" + credits + "). A loan transaction that does not balance is a corrupt ledger.");
        }
    }

    // ----------------------------------------------------------------------------------------------------------------
    // Fixture construction. Reuses the exact LoanTransactionDTO / LoanDTO idiom from the shipped processor tests.
    // ----------------------------------------------------------------------------------------------------------------

    private LoanTransactionEnumData txnType() {
        // Unstubbed boolean predicates default to false; each fixture stubs only the predicates its path checks.
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

    private Tally runCash(LoanDTO loanDTO) {
        Tally tally = new Tally();
        AccountingProcessorHelper helper = mockHelper(tally);
        AccountingProcessorForLoan processor = new CashBasedAccountingProcessorForLoan(helper,
                mock(org.apache.fineract.accounting.journalentry.service.JournalEntryWritePlatformService.class),
                new org.apache.fineract.accounting.journalentry.service.LoanCommonAccountingHelper(helper));
        processor.createJournalEntriesForLoan(loanDTO);
        return tally;
    }

    private Tally runAccrual(LoanDTO loanDTO) {
        Tally tally = new Tally();
        AccountingProcessorHelper helper = mockHelper(tally);
        AccountingProcessorForLoan processor = new AccrualBasedAccountingProcessorForLoan(helper,
                mock(org.apache.fineract.accounting.journalentry.service.JournalEntryWritePlatformService.class),
                new org.apache.fineract.accounting.journalentry.service.LoanCommonAccountingHelper(helper));
        processor.createJournalEntriesForLoan(loanDTO);
        return tally;
    }

    private static List<ChargePaymentDTO> onePayment(BigDecimal amount) {
        List<ChargePaymentDTO> list = new ArrayList<>();
        list.add(new ChargePaymentDTO(1L, amount, 1L));
        return list;
    }

    // ----------------------------------------------------------------------------------------------------------------
    // The battery. Each test drives one transaction shape through the applicable processor(s).
    // ----------------------------------------------------------------------------------------------------------------

    @Test
    void cashRepaymentAllLegsBalances() {
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isRepaymentType()).thenReturn(true);
        LoanTransactionDTO t = txn("cash-repay", type, new BigDecimal("340.00"), new BigDecimal("200.00"), new BigDecimal("100.00"),
                new BigDecimal("25.00"), new BigDecimal("15.00"), null, onePayment(new BigDecimal("25.00")),
                onePayment(new BigDecimal("15.00")));
        assertBalanced("cash repayment (principal+interest+fees+penalties)", runCash(loan(true, false, false, null, t)));
    }

    @Test
    void cashDisbursementBalances() {
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isDisbursement()).thenReturn(true);
        LoanTransactionDTO t = txn("cash-disb", type, new BigDecimal("1000.00"), null, null, null, null, new BigDecimal("0.00"), null, null);
        assertBalanced("cash disbursement", runCash(loan(true, false, false, null, t)));
    }

    @Test
    void cashWriteOffBalances() {
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isWriteOff()).thenReturn(true);
        LoanTransactionDTO t = txn("cash-writeoff", type, new BigDecimal("500.00"), new BigDecimal("500.00"), null, null, null, null, null,
                null);
        assertBalanced("cash write-off (principal)", runCash(loan(true, false, false, null, t)));
    }

    @Test
    void cashRefundOfOverpaymentBalances() {
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isRefund()).thenReturn(true);
        LoanTransactionDTO t = txn("cash-refund", type, new BigDecimal("75.00"), null, null, null, null, null, null, null);
        assertBalanced("cash refund of overpayment", runCash(loan(true, false, false, null, t)));
    }

    @Test
    void cashChargeOffRepaymentBalances() {
        // charge-off repayment path: the dual-accumulator trap the scout flagged (credit map vs totalDebitAmount).
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isRepaymentType()).thenReturn(true);
        AccountingProcessorHelperStubForChargeOff stub = new AccountingProcessorHelperStubForChargeOff();
        Tally tally = new Tally();
        AccountingProcessorHelper helper = mockHelper(tally);
        stub.installGlAccounts(helper);
        LoanTransactionDTO t = txn("cash-chargeoff-repay", type, new BigDecimal("340.00"), new BigDecimal("200.00"),
                new BigDecimal("100.00"), new BigDecimal("25.00"), new BigDecimal("15.00"), null, onePayment(new BigDecimal("25.00")),
                onePayment(new BigDecimal("15.00")));
        AccountingProcessorForLoan processor = new CashBasedAccountingProcessorForLoan(helper,
                mock(org.apache.fineract.accounting.journalentry.service.JournalEntryWritePlatformService.class),
                new org.apache.fineract.accounting.journalentry.service.LoanCommonAccountingHelper(helper));
        processor.createJournalEntriesForLoan(loan(true, true, false, null, t));
        assertBalanced("cash charge-off repayment", tally);
    }

    @Test
    void cashTransferInitiationBalances() {
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isInitiateTransfer()).thenReturn(true);
        LoanTransactionDTO t = txn("cash-transfer", type, new BigDecimal("600.00"), new BigDecimal("500.00"), null, null, null, null, null,
                null);
        assertBalanced("cash transfer initiation", runCash(loan(true, false, false, null, t)));
    }

    @Test
    void accrualRepaymentAllLegsBalances() {
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isRepaymentType()).thenReturn(true);
        LoanTransactionDTO t = txn("accr-repay", type, new BigDecimal("340.00"), new BigDecimal("200.00"), new BigDecimal("100.00"),
                new BigDecimal("25.00"), new BigDecimal("15.00"), null, onePayment(new BigDecimal("25.00")),
                onePayment(new BigDecimal("15.00")));
        assertBalanced("accrual repayment (principal+interest+fees+penalties)", runAccrual(loan(false, false, false, null, t)));
    }

    @Test
    void accrualDisbursementBalances() {
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isDisbursement()).thenReturn(true);
        LoanTransactionDTO t = txn("accr-disb", type, new BigDecimal("1000.00"), null, null, null, null, new BigDecimal("0.00"), null, null);
        assertBalanced("accrual disbursement", runAccrual(loan(false, false, false, null, t)));
    }

    @Test
    void accrualWriteOffBalances() {
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isWriteOff()).thenReturn(true);
        LoanTransactionDTO t = txn("accr-writeoff", type, new BigDecimal("500.00"), new BigDecimal("500.00"), new BigDecimal("50.00"),
                new BigDecimal("10.00"), new BigDecimal("5.00"), null, null, null);
        assertBalanced("accrual write-off (all portions)", runAccrual(loan(false, false, false, null, t)));
    }

    @Test
    void accrualTransferApprovalBalances() {
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isApproveTransfer()).thenReturn(true);
        LoanTransactionDTO t = txn("accr-transfer", type, new BigDecimal("600.00"), new BigDecimal("500.00"), null, null, null, null, null,
                null);
        assertBalanced("accrual transfer approval", runAccrual(loan(false, false, false, null, t)));
    }

    @Test
    void accrualChargeOffBalances() {
        // accrual charge-off marks the loan as charged off and posts principal+interest+fees+penalties to the charge-off legs.
        LoanTransactionEnumData type = txnType();
        lenient().when(type.isChargeoff()).thenReturn(true);
        Tally tally = new Tally();
        AccountingProcessorHelper helper = mockHelper(tally);
        new AccountingProcessorHelperStubForChargeOff().installGlAccounts(helper);
        lenient().when(helper.getChargeOffMappingByCodeValue(any(), any(), any())).thenReturn(null);
        LoanTransactionDTO t = txn("accr-chargeoff", type, new BigDecimal("340.00"), new BigDecimal("200.00"), new BigDecimal("100.00"),
                new BigDecimal("25.00"), new BigDecimal("15.00"), null, null, null);
        AccountingProcessorForLoan processor = new AccrualBasedAccountingProcessorForLoan(helper,
                mock(org.apache.fineract.accounting.journalentry.service.JournalEntryWritePlatformService.class),
                new org.apache.fineract.accounting.journalentry.service.LoanCommonAccountingHelper(helper));
        processor.createJournalEntriesForLoan(loan(false, true, false, 15L, t));
        assertBalanced("accrual charge-off", tally);
    }

    @Test
    void multiTransactionLoanEachBalances() {
        // several transactions on one loan: each transaction id must balance independently.
        LoanTransactionEnumData disb = txnType();
        lenient().when(disb.isDisbursement()).thenReturn(true);
        LoanTransactionEnumData repay = txnType();
        lenient().when(repay.isRepaymentType()).thenReturn(true);
        LoanTransactionDTO t1 = txn("multi-disb", disb, new BigDecimal("1000.00"), null, null, null, null, new BigDecimal("0.00"), null,
                null);
        LoanTransactionDTO t2 = txn("multi-repay", repay, new BigDecimal("315.00"), new BigDecimal("200.00"), new BigDecimal("100.00"),
                new BigDecimal("15.00"), null, null, onePayment(new BigDecimal("15.00")), null);
        assertBalanced("multi-transaction loan", runCash(loan(true, false, false, null, t1, t2)));
    }

    /**
     * Stubs the GL-account lookups the charge-off paths dereference. On these paths the processor resolves accounts via
     * {@code getLinkedGLAccountForLoanProduct} / {@code getChargeOffMappingByCodeValue} and keys balance maps by the
     * returned account's id, so each account type must return a distinct non-null {@link GLAccount}.
     */
    private static final class AccountingProcessorHelperStubForChargeOff {

        void installGlAccounts(AccountingProcessorHelper helper) {
            // getLinkedGLAccountForLoanProduct is already stubbed for every helper in mockHelper(); here we add the
            // charge-off reason mapping the charge-off paths resolve.
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
