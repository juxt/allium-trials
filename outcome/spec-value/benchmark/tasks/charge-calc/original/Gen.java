import java.lang.reflect.*;
public class Gen {
    static String[] PREDS={"isPercentageOfAmount","isPercentageOfAmountAndInterest","isPercentageOfInterest","isFlat","isAllowedSavingsChargeCalculationType","isAllowedClientChargeCalculationType","isPercentageBased","hasInterest","isPercentageOfDisbursementAmount"};
    public static void main(String[] x) throws Exception {
        StringBuilder sb=new StringBuilder("[\n"); boolean first=true;
        for (Object t : ChargeCalculationType.class.getEnumConstants()){
            for (String p: PREDS){
                boolean v=(boolean)ChargeCalculationType.class.getMethod(p).invoke(t);
                if(!first) sb.append(",\n"); first=false;
                sb.append("  {\"type\":\""+((Enum)t).name()+"\",\"predicate\":\""+p+"\",\"expected\":"+v+"}");
            }
        }
        sb.append("\n]"); System.out.println(sb);
    }
}
