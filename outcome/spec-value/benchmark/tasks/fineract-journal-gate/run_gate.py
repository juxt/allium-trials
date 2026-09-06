import subprocess, sys, os, shutil, tempfile
suite=sys.argv[1]; DIR=os.path.dirname(os.path.abspath(__file__))
def run(cf):
    d=tempfile.mkdtemp(); shutil.copy(suite,os.path.join(d,"test_gate.py")); shutil.copy(os.path.join(DIR,cf),os.path.join(d,"solution.py"))
    try: return subprocess.run([sys.executable,"-m","pytest","test_gate.py","-q"],cwd=d,timeout=30,capture_output=True).returncode==0
    except Exception: return False
b=run("buggy.py"); c=run("correct.py"); print("CATCH" if (not b and c) else ("MISS" if b else "FALSEALARM"))
