"""run_suite.py <suite.py> <solution.py> -> prints PASS | FAIL | TIMEOUT (hard subprocess timeout so a
non-terminating implementation cannot be swallowed by the test's own exception handling)."""
import subprocess, sys, os, shutil, tempfile
suite, sol = sys.argv[1], sys.argv[2]
d = tempfile.mkdtemp()
shutil.copy(suite, os.path.join(d, "test_gen.py"))
shutil.copy(sol, os.path.join(d, "solution.py"))
try:
    r = subprocess.run([sys.executable, "-m", "pytest", "test_gen.py", "-q"], cwd=d, timeout=20, capture_output=True)
    print("PASS" if r.returncode == 0 else "FAIL")
except subprocess.TimeoutExpired:
    print("TIMEOUT")
