import java.math.BigDecimal;
import java.lang.reflect.*;
import java.util.*;
public class Gen {
    static BigDecimal bd(String s){ return s==null?null:new BigDecimal(s); }
    static String J(Object o){ if(o==null) return "null"; if(o instanceof Boolean) return o.toString();
        if(o instanceof BigDecimal) return "\""+((BigDecimal)o).toPlainString()+"\""; return "\""+o+"\""; }
    static String arg(Object o){ return o==null?"null":(o instanceof Boolean?o.toString():"\""+((BigDecimal)o).toPlainString()+"\""); }
    static List<String> rows = new ArrayList<>();
    static void u(String fn, Object r, Object... args){
        StringBuilder a=new StringBuilder("["); for(int i=0;i<args.length;i++){ if(i>0)a.append(","); a.append(arg(args[i])); } a.append("]");
        rows.add("  {\"fn\":\""+fn+"\",\"args\":"+a+",\"expected\":"+J(r)+"}");
    }
    public static void main(String[] x) throws Exception {
        String[] vals = {null,"0","0.00","5","5.50","-3","-3.25","100","-0.01","0.1"};
        String[] unary = {"nullToZero","zeroToNull","negativeToZero","isEmpty","isZero","isGreaterThanZero","isLessThanZero","isLessThanOrEqualZero","abs","negate","stripTrailingZeros"};
        for(String fn: unary){ Method m=MathUtilPure.class.getMethod(fn, BigDecimal.class);
            for(String v: vals){ try{ u(fn, m.invoke(null, bd(v)), bd(v)); }catch(Exception e){} } }
        String[] binary = {"isEqualTo","isGreaterThan","isLessThan","isGreaterThanOrEqualTo","subtract","subtractToZero"};
        for(String fn: binary){ Method m=MathUtilPure.class.getMethod(fn, BigDecimal.class, BigDecimal.class);
            for(String a: vals) for(String b: vals){ try{ u(fn, m.invoke(null, bd(a), bd(b)), bd(a), bd(b)); }catch(Exception e){} } }
        // isLessThanOrEqualTo: second must be non-null (real code NPEs on null second)
        for(String a: vals) for(String b: new String[]{"0","5","-3","100"}){ try{ u("isLessThanOrEqualTo", MathUtilPure.isLessThanOrEqualTo(bd(a),bd(b)), bd(a), bd(b)); }catch(Exception e){} }
        // nullToDefault + min(notNull)
        for(String a: vals) for(String d: new String[]{"0","7","-1"}) u("nullToDefault", MathUtilPure.nullToDefault(bd(a),bd(d)), bd(a), bd(d));
        for(String a: vals) for(String b: vals) for(boolean nn: new boolean[]{true,false}){ try{ u("min", MathUtilPure.min(bd(a),bd(b),nn), bd(a), bd(b), nn); }catch(Exception e){} }
        System.out.println("["+String.join(",\n", rows)+"]");
    }
}
