# 🌌 Quantum Circuit Designer & Simulator

A high-performance, professional-grade visual quantum circuit designer and simulator. This application combines a modern drag-and-drop Next.js frontend interface with an optional Python backend powered by Qiskit for advanced quantum statevector analysis, density matrices, and realistic noise simulations.

---

## 🚀 Key Features

*   **Visual Circuit Builder:** Drag-and-drop interface for designing quantum circuits. Supports a variety of gates including Single-qubit (`H`, `X`, `Y`, `Z`, `S`, `T`, `Rx`, `Ry`, `Rz`, custom Unitary `U`) and Multi-qubit (`CNOT`, `iSWAP`, `Swap`, `Measure`).
*   **Multi-View Visualizations:**
    *   **Bloch Sphere:** Interactive 3D Bloch sphere representation for visualizing individual qubit state projections.
    *   **Q-Sphere:** Elegant spherical plot displaying multi-qubit statevector amplitudes, phases, and entanglement.
    *   **Density Matrix:** View the raw density matrix representing the purity and coherence of your quantum system.
    *   **Amplitudes & Probabilities:** Interactive histograms and tables detailing state occupancy probabilities.
*   **Optional Qiskit Integration:** Leverages a local FastAPI server to compute advanced quantum measurements and run noisy simulations.
*   **Noise Simulation Engine:** Test circuits under realistic physical conditions including depolarizing noise, thermal relaxation ($T_1$ and $T_2$ times), and readout errors.
*   **Local Storage Library:** Save, update, and manage your custom circuits locally inside your browser (uses `localStorage` via custom hooks).
*   **Elegant Styling:** Responsive, premium interface with a beautiful dark mode and seamless transitions.

---

## 🛠️ Architecture Overview

The project is structured as a decoupled web application:
1.  **Frontend:** Next.js 15 app containing the visual builder, canvas/webgl visualizers, and state management.
2.  **Backend:** FastAPI server (`qiskit_api.py`) interfacing with Qiskit and Qiskit Aer to run high-performance simulations.

---

## 📂 Project Structure

```
private-quantum-simulator/
├── app/
│   ├── dashboard/               # User dashboard views
│   ├── globals.css             # Tailored Tailwind CSS system & typography
│   ├── layout.tsx              # Root HTML wrapper and global theme shell
│   └── page.tsx                # Entry point mounting the Quantum Simulator
├── components/
│   ├── ui/                     # Accessible primitive Radix UI elements
│   ├── app-shell.tsx           # Global sidebar and header structure
│   ├── nav-bar.tsx             # Top pill-style navigation tabs
│   ├── quantum-simulator.tsx   # Core tab layout and workspace coordination
│   ├── quantum-circuit-builder.tsx # Drag-and-drop editing grid & API trigger
│   ├── bloch-sphere-visualization.tsx # 3D Bloch sphere calculations & rendering
│   ├── q-sphere-visualization.tsx # Statevector amplitude & phase visualizer
│   ├── individual-bloch-sphere.tsx # Visuals for separate qubit projections
│   ├── circuit-library-sidebar.tsx # Collapsible repository of saved circuits
│   ├── circuit-history-panel.tsx # Undo/redo and editing history list
│   └── learning-path.tsx       # Embedded glossary and educational guide
├── hooks/
│   ├── use-circuit-storage.ts  # Handles reading/writing circuits to LocalStorage
│   └── use-toast.ts            # Provides UI feedback notifications
├── pyproject.toml              # Python project description & dependencies
├── uv.lock                     # UV lockfile for rapid dependency sync
├── qiskit_api.py               # FastAPI + Qiskit simulation backend API
├── package.json                # Next.js frontend package list
└── README.md                   # Project documentation
```

---

## 🏁 Quickstart

### 1. Frontend Setup (Next.js)

First, install the frontend dependencies and run the Next.js development server.

With **pnpm** (recommended):
```bash
pnpm install
pnpm dev
```

Or with **npm**:
```bash
npm install
npm run dev
```

Set `NEXT_PUBLIC_FRONTEND_URL` in `env.local` for the interface URL.

---

### 2. Backend Setup (Qiskit API)

Set `NEXT_PUBLIC_QISKIT_API_URL` in `env.local` for the backend URL.

You can set up and run the backend using **uv** (recommended for speed and pyproject integration) or standard **pip**.

#### Option A: Using `uv` (Recommended)
If you have [uv](https://github.com/astral-sh/uv) installed, you can launch the FastAPI server directly with one command:
```bash
uv run uvicorn qiskit_api:app --reload --port 8000
```
*`uv` will automatically create a virtual environment, sync the dependencies from `pyproject.toml`, and run the app.*

#### Option B: Standard Python Virtual Environment (`venv`)
If using standard python tools:

**macOS / Linux:**
```bash
# Create a virtual environment
python -m venv .venv
# Activate the environment
source .venv/bin/activate
# Install required packages
pip install fastapi uvicorn qiskit qiskit-aer numpy
# Start the FastAPI server
uvicorn qiskit_api:app --reload --port 8000
```

**Windows (PowerShell):**
```powershell
# Create a virtual environment
python -m venv .venv
# Activate the environment
.\.venv\Scripts\Activate.ps1
# Install required packages
pip install fastapi uvicorn qiskit qiskit-aer numpy
# Start the FastAPI server
uvicorn qiskit_api:app --reload --port 8000
```

---

## 🔌 API Endpoints

The backend exposing the FastAPI service contains the following endpoints:

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/` | `GET` | Server status and metadata |
| `/simulate` | `POST` | Simulates a list of quantum gates and returns the final statevector, probabilities, and Bloch sphere coordinates |
| `/circuit-info` | `POST` | Analyzes circuit composition, computing depth, width, and gate counts |
| `/test-noise` | `POST` | Simulates a quantum circuit under custom depolarizing and thermal noise conditions |
| `/noise-presets` | `GET` | Returns predefined noise configurations (e.g., Amplitude Damping, Dephasing) |

---

## 🔧 Troubleshooting & Tips

*   **Qiskit Aer Warning:** If `qiskit-aer` fails to install or is missing, the API will output a fallback warning and use `BasicSimulator`. Note that noise simulations will be disabled in fallback mode.
*   **CORS Issues:** The backend API has Cross-Origin Resource Sharing (CORS) enabled by default for all origins (`*`) to ensure the frontend can fetch simulations locally.
*   **Port Conflicts:** If your backend port changes, update `NEXT_PUBLIC_QISKIT_API_URL` in `env.local` so the frontend points at the correct server.
*   **Cache Clearing:** If the Next.js dev server behaves unexpectedly, you can clean your build cache:
    ```bash
    rm -rf .next node_modules
    pnpm install # or npm install
    ```
