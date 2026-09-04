import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
public final class MathUtilPure {
    static MathContext mc() { return new MathContext(34, RoundingMode.HALF_EVEN); }
    public static BigDecimal nullToDefault(BigDecimal v, BigDecimal def){ return v==null?def:v; }
    public static BigDecimal nullToZero(BigDecimal v){ return nullToDefault(v, BigDecimal.ZERO); }
    public static boolean isEmpty(BigDecimal v){ return v==null || BigDecimal.ZERO.compareTo(v)==0; }
    public static boolean isZero(BigDecimal v){ return v!=null && v.compareTo(BigDecimal.ZERO)==0; }
    public static boolean isGreaterThanZero(BigDecimal v){ return v!=null && v.compareTo(BigDecimal.ZERO)>0; }
    public static boolean isLessThanZero(BigDecimal v){ return v!=null && v.compareTo(BigDecimal.ZERO)<0; }
    public static boolean isLessThanOrEqualZero(BigDecimal v){ return nullToZero(v).compareTo(BigDecimal.ZERO)<=0; }
    public static BigDecimal zeroToNull(BigDecimal v){ return isEmpty(v)?null:v; }
    public static BigDecimal negativeToZero(BigDecimal v){ return isGreaterThanZero(v)?v:BigDecimal.ZERO; }
    public static boolean isEqualTo(BigDecimal a, BigDecimal b){ return nullToZero(a).compareTo(nullToZero(b))==0; }
    public static boolean isGreaterThan(BigDecimal a, BigDecimal b){ return nullToZero(a).compareTo(nullToZero(b))>0; }
    public static boolean isLessThan(BigDecimal a, BigDecimal b){ return nullToZero(a).compareTo(nullToZero(b))<0; }
    public static boolean isGreaterThanOrEqualTo(BigDecimal a, BigDecimal b){ return nullToZero(a).compareTo(nullToZero(b))>=0; }
    public static boolean isLessThanOrEqualTo(BigDecimal a, BigDecimal b){ return nullToZero(a).compareTo(b)<=0; }
    public static BigDecimal abs(BigDecimal v){ return v==null?BigDecimal.ZERO:v.abs(); }
    public static BigDecimal min(BigDecimal a, BigDecimal b, boolean notNull){
        return notNull ? (a==null?b:(b==null?a:min(a,b,false))) : (isLessThan(a,b)?a:b); }
    public static BigDecimal subtract(BigDecimal a, BigDecimal b){ return nullToZero(a).subtract(nullToZero(b), mc()); }
    public static BigDecimal subtractToZero(BigDecimal a, BigDecimal b){ return negativeToZero(subtract(a,b)); }
    public static BigDecimal negate(BigDecimal v){ return nullToZero(v).negate(mc()); }
    public static BigDecimal stripTrailingZeros(BigDecimal v){ return v==null?null:new BigDecimal(v.stripTrailingZeros().toPlainString()); }
}
