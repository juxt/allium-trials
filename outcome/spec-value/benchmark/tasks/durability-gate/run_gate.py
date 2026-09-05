import subprocess, sys, os, shutil, tempfile
suite = sys.argv[1]
DIR = os.path.dirname(os.path.abspath(__file__))
def run(codefile):
    d = tempfile.mkdtemp()
    shutil.copy(suite, os.path.join(d, "test_gate.py"))
    shutil.copy(os.path.join(DIR, codefile), os.path.join(d, "solution.py"))
    try:
        r = subprocess.run([sys.executable,"-m","pytest","test_gate.py","-q"], cwd=d, timeout=30, capture_output=True)
        return r.returncode==0
    except Exception: return False
buggy_passes = run("buggy.py")
correct_passes = run("correct.py")
# catch = suite FAILS on buggy (found the regression) AND PASSES on correct (no false alarm)
print("CATCH" if (not buggy_passes and correct_passes) else ("MISS" if buggy_passes else "FALSEALARM"))
