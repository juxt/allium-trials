import java.math.BigDecimal;
import java.math.MathContext;
public class Main {
    static boolean first = true;
    static void emit(String o){ if(!first) System.out.println(","); first=false; System.out.print("  "+o); }
    public static void main(String[] a) {
        MathContext mc = new MathContext(12);
        System.out.println("[");
        int[] npers = {1,3,6,12,24,36};
        String[] pmts = {"100","450","1000","5000"};
        String[] pvs = {"-9000","-100000","-2500","-50000"};
        for (int n : npers) for (String pm : pmts) for (String pv : pvs) {
            try { BigDecimal r = TvmFunctions.rate(n, new BigDecimal(pm), new BigDecimal(pv), mc);
                emit("{\"fn\":\"rate\",\"nper\":"+n+",\"pmt\":\""+pm+"\",\"pv\":\""+pv+"\",\"expected\":\""+r.toPlainString()+"\"}");
            } catch (Exception e) {}
        }
        // zero-rate edge case: pv + pmt*n == 0  (e.g. pv=-1200, pmt=100, n=12)
        try { BigDecimal r = TvmFunctions.rate(12, new BigDecimal("100"), new BigDecimal("-1200"), mc);
            emit("{\"fn\":\"rate\",\"nper\":12,\"pmt\":\"100\",\"pv\":\"-1200\",\"expected\":\""+r.toPlainString()+"\",\"note\":\"zero-rate edge\"}");
        } catch (Exception e) {}
        // discountFactor(eir, days, mc)
        String[] eirs = {"0.05","0.12","0.18","0.0"};
        long[] days = {30,90,180,365};
        for (String e : eirs) for (long d : days) {
            try { BigDecimal df = TvmFunctions.discountFactor(new BigDecimal(e), d, mc);
                emit("{\"fn\":\"discountFactor\",\"eir\":\""+e+"\",\"days\":"+d+",\"expected\":\""+df.toPlainString()+"\"}");
            } catch (Exception ex) {}
        }
        System.out.println("\n]");
    }
}
