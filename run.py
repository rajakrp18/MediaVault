import os
import sys
import subprocess
import time
import socket

BACKEND_PORT = 8008
VITE_PORTS   = [5173, 5174, 5175, 5176]   # Vite will try these in order


# ── Helpers ────────────────────────────────────────────────────

def port_in_use(port: int) -> bool:
    """Check if anything is listening on port — tries both IPv4 and IPv6."""
    for host in ('127.0.0.1', '::1'):
        try:
            family = socket.AF_INET if '.' in host else socket.AF_INET6
            with socket.socket(family, socket.SOCK_STREAM) as s:
                s.settimeout(0.3)
                if s.connect_ex((host, port)) == 0:
                    return True
        except Exception:
            pass
    return False


def get_pids_on_port(port: int):
    """Return set of PIDs that are LISTENING on port (IPv4 + IPv6)."""
    pids = set()
    try:
        r = subprocess.run('netstat -ano', shell=True,
                           capture_output=True, text=True)
        for line in r.stdout.splitlines():
            if f':{port}' in line and 'LISTENING' in line:
                parts = line.split()
                if parts and parts[-1].isdigit():
                    pids.add(parts[-1])
    except Exception:
        pass
    return pids


def kill_port(port: int):
    pids = get_pids_on_port(port)
    if pids:
        for pid in pids:
            subprocess.run(f'taskkill /PID {pid} /F',
                           shell=True, capture_output=True)
        print(f"  [cleanup] Port {port}: killed PID(s) {', '.join(pids)}")
    return bool(pids)


def wait_port_free(port: int, timeout: int = 12) -> bool:
    """Poll until the port stops accepting connections."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        if not port_in_use(port):
            return True
        time.sleep(0.4)
    return False


def wait_for_port(port: int, timeout: int = 20) -> bool:
    """Poll until the port starts accepting connections."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        if port_in_use(port):
            return True
        time.sleep(0.4)
    return False


# ── Main ────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  MediaVault - Universal Video, Audio & Playlist Downloader")
    print("=" * 60)

    base_dir     = os.path.dirname(os.path.abspath(__file__))
    backend_dir  = os.path.join(base_dir, "backend")
    frontend_dir = os.path.join(base_dir, "frontend")

    # ── Step 0: kill stale processes ──────────────────────────
    print("\n[0] Cleaning up existing processes...")
    all_ports = [BACKEND_PORT] + VITE_PORTS
    for port in all_ports:
        kill_port(port)

    # Wait until ALL candidate ports are free
    for port in all_ports:
        if not wait_port_free(port, timeout=10):
            print(f"  WARNING: Port {port} still busy — proceeding anyway.")
    print("  Ports clear.")

    procs = []

    # ── Step 1: Backend ────────────────────────────────────────
    print(f"\n[1] Starting Backend  (http://localhost:{BACKEND_PORT})...")
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app",
         "--host", "0.0.0.0", "--port", str(BACKEND_PORT)],
        cwd=backend_dir
    )
    procs.append(backend_proc)

    if not wait_for_port(BACKEND_PORT, timeout=15):
        print("  ERROR: Backend failed to start.")
        backend_proc.terminate()
        sys.exit(1)
    print(f"  Backend ready -> http://localhost:{BACKEND_PORT}")

    # ── Step 2: Frontend ───────────────────────────────────────
    print(f"\n[2] Starting Frontend...")

    if not os.path.exists(os.path.join(frontend_dir, "node_modules")):
        print("  Installing dependencies (first run)...")
        subprocess.run("npm install", cwd=frontend_dir, shell=True, check=True)

    # Port configured via vite.config.js (5173, strictPort:false)
    frontend_proc = subprocess.Popen(
        "npm run dev", cwd=frontend_dir, shell=True
    )
    procs.append(frontend_proc)

    # Scan all candidate ports to find where Vite actually bound
    actual_port = None
    deadline = time.time() + 25
    while time.time() < deadline and actual_port is None:
        for p in VITE_PORTS:
            if port_in_use(p):
                actual_port = p
                break
        if actual_port is None:
            time.sleep(0.5)

    if actual_port is None:
        print("  WARNING: Could not detect frontend port within timeout.")
        print("  Vite may still be starting — check http://localhost:5173 or :5174")
        actual_port = 5173  # best guess
    else:
        print(f"  Frontend ready -> http://localhost:{actual_port}")

    # ── Summary ────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  MediaVault is RUNNING")
    print(f"  Web UI   ->  http://localhost:{actual_port}")
    print(f"  API docs ->  http://localhost:{BACKEND_PORT}/docs")
    print("=" * 60)
    if actual_port != 5173:
        print(f"\n  NOTE: Vite used port {actual_port} (5173 was still held by OS).")
        print(f"  Open http://localhost:{actual_port} in your browser.\n")
    print("""
  YOUTUBE SETUP (one-time):
  1. Install 'Get cookies.txt LOCALLY' Chrome extension
  2. Visit youtube.com (logged in) -> click extension -> Export
  3. Rename to cookies.txt, place in:  backend\\cookies.txt
  4. In app -> [Setup Cookies] -> 'None (cookies.txt)' -> Save

  Press Ctrl+C to stop.
""")

    # ── Keep alive ─────────────────────────────────────────────
    try:
        while True:
            # Only restart/stop if the BACKEND dies unexpectedly
            # (npm shell for Vite may exit even while Vite is running)
            if backend_proc.poll() is not None:
                print("\n  Backend exited unexpectedly!")
                raise KeyboardInterrupt
            time.sleep(2)
    except KeyboardInterrupt:
        print("\nStopping MediaVault...")
    finally:
        for p in procs:
            try:
                p.terminate()
                p.wait(timeout=5)
            except Exception:
                try:
                    p.kill()
                except Exception:
                    pass
        print("All servers stopped.")


if __name__ == "__main__":
    main()
