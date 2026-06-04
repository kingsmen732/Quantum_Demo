from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from qiskit import QuantumCircuit, transpile, QuantumRegister, ClassicalRegister
try:
    from qiskit_aer import AerSimulator
    from qiskit_aer.noise import NoiseModel, depolarizing_error, thermal_relaxation_error
    from qiskit_aer.noise import ReadoutError
    HAS_AER = True
    # Aer is optional; keep this quiet unless debugging is needed
    # print("✅ Qiskit Aer loaded successfully")
except ImportError as e:
    # Print once at import time so users understand why noise is disabled
    print(f"⚠️  Qiskit Aer not available: {e}")
    print("📌 Falling back to BasicSimulator (noise disabled)")
    from qiskit.providers.basic_provider import BasicSimulator
    HAS_AER = False
from qiskit.quantum_info import Statevector, DensityMatrix, partial_trace
from qiskit.circuit.library import RXGate, RYGate, RZGate, UGate
try:
    # Qiskit-terra >= 0.24 includes iSwapGate in circuit.library
    from qiskit.circuit.library import iSwapGate
    HAS_ISWAP = True
except Exception:
    HAS_ISWAP = False
import numpy as np

app = FastAPI(title="Qiskit Backend (v2.1.2 compatible)")

# Toggle detailed debug logging
DEBUG = False

def log(*args, **kwargs):
    if DEBUG:
        print(*args, **kwargs)

# Allow CORS for local dev/frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class GateOp(BaseModel):
    name: str  # e.g. "h", "x", "cx", "rz"
    qubits: List[int]
    params: Optional[List[float]] = None  # for rotation gates

class NoiseParameters(BaseModel):
    noise_enabled: bool = False
    depolarizing_prob: float = 0.001
    t1_time: float = 50.0  # T1 relaxation time in microseconds
    t2_time: float = 70.0  # T2 dephasing time in microseconds
    readout_error_prob: float = 0.01
    gate_time: float = 0.1  # Gate time in microseconds
    thermal_population: float = 0.0  # Excited state population at thermal equilibrium

class CircuitRequest(BaseModel):
    num_qubits: int
    gates: List[GateOp]
    shots: Optional[int] = 1024
    noise_params: Optional[NoiseParameters] = NoiseParameters()

def create_noise_model(noise_params: NoiseParameters):
    """
    Create a comprehensive noise model with various error types
    """
    if not noise_params.noise_enabled or not HAS_AER:
        return None
    
    noise_model = NoiseModel()
    
    # Single-qubit gate errors
    # Include native basis gates after transpile: 'rz', 'sx', 'x', and identity 'id'
    single_qubit_gates = [
        'h', 'x', 'sx', 'y', 'z', 's', 'sdg', 't', 'tdg',
        'rx', 'ry', 'rz', 'u', 'u1', 'u2', 'u3', 'id'
    ]
    
    # Two-qubit gate errors (strictly 2-qubit)
    two_qubit_gates = ['cx', 'cy', 'cz', 'ch', 'crx', 'cry', 'crz', 'cu', 'swap', 'iswap']
    # Three-qubit gate errors
    three_qubit_gates = ['ccx']
    
    # 1. Depolarizing errors
    if noise_params.depolarizing_prob > 0:
        # Single-qubit depolarizing error
        single_qubit_error = depolarizing_error(noise_params.depolarizing_prob, 1)
        noise_model.add_all_qubit_quantum_error(single_qubit_error, single_qubit_gates)
        
        # Two-qubit depolarizing error (typically higher)
        two_qubit_error = depolarizing_error(noise_params.depolarizing_prob * 10, 2)
        noise_model.add_all_qubit_quantum_error(two_qubit_error, two_qubit_gates)
        
        # Three-qubit depolarizing error (even higher)
        three_qubit_error = depolarizing_error(noise_params.depolarizing_prob * 20, 3)
        noise_model.add_all_qubit_quantum_error(three_qubit_error, three_qubit_gates)
    
    # 2. Thermal relaxation errors
    if noise_params.t1_time > 0 and noise_params.t2_time > 0:
        # Convert user-friendly microseconds to seconds for Qiskit
        t1_s = noise_params.t1_time * 1e-6
        t2_s = noise_params.t2_time * 1e-6
        gate_time_1q_s = noise_params.gate_time * 1e-6

        # Single-qubit thermal relaxation error
        thermal_error_1q = thermal_relaxation_error(
            t1=t1_s,
            t2=t2_s,
            time=gate_time_1q_s,
            excited_state_population=noise_params.thermal_population
        )
        noise_model.add_all_qubit_quantum_error(thermal_error_1q, single_qubit_gates)
        
        # For two-qubit gates, use longer gate time and tensor single-qubit errors
        gate_time_2q_s = gate_time_1q_s * 5  # Two-qubit gates typically take longer
        thermal_error_2q_each = thermal_relaxation_error(
            t1=t1_s,
            t2=t2_s,
            time=gate_time_2q_s,
            excited_state_population=noise_params.thermal_population
        )
        two_qubit_thermal_error = thermal_error_2q_each.tensor(thermal_error_2q_each)
        noise_model.add_all_qubit_quantum_error(two_qubit_thermal_error, two_qubit_gates)

        # For three-qubit gates, use even longer time and tensor three times
        gate_time_3q_s = gate_time_1q_s * 10
        thermal_error_3q_each = thermal_relaxation_error(
            t1=t1_s,
            t2=t2_s,
            time=gate_time_3q_s,
            excited_state_population=noise_params.thermal_population
        )
        three_qubit_thermal_error = (
            thermal_error_3q_each.tensor(thermal_error_3q_each).tensor(thermal_error_3q_each)
        )
        noise_model.add_all_qubit_quantum_error(three_qubit_thermal_error, three_qubit_gates)
    
    # 3. Readout errors
    if noise_params.readout_error_prob > 0:
        readout_error = ReadoutError([
            [1 - noise_params.readout_error_prob, noise_params.readout_error_prob],
            [noise_params.readout_error_prob, 1 - noise_params.readout_error_prob]
        ])
        noise_model.add_all_qubit_readout_error(readout_error)
    
    log(f"\n🔊 NOISE MODEL CREATED:")
    log(f"   Depolarizing: {noise_params.depolarizing_prob}")
    log(f"   T1: {noise_params.t1_time}μs, T2: {noise_params.t2_time}μs")
    log(f"   Gate time: {noise_params.gate_time}μs")
    log(f"   Readout error: {noise_params.readout_error_prob}")
    log(f"   Thermal population: {noise_params.thermal_population}")
    
    return noise_model

@app.get("/")
def root():
    backend_type = "Qiskit Aer" if HAS_AER else "Qiskit BasicSimulator"
    features = "with noise models" if HAS_AER else "basic simulation only"
    return {"status": "ok", "msg": f"{backend_type} FastAPI backend running {features}", "has_aer": HAS_AER}

@app.post("/simulate")
def simulate_circuit(req: CircuitRequest):
    try:
        log("\n" + "="*60)
        log("🔬 QISKIT SIMULATION REQUEST")
        log("="*60)
        log(f"📊 Number of qubits: {req.num_qubits}")
        log(f"🎯 Number of shots: {req.shots}")
        log(f"🚪 Number of gates: {len(req.gates)}")
        
        # Debug: Show the raw request
        log("\n📥 RAW GATES RECEIVED FROM FRONTEND:")
        for i, gate in enumerate(req.gates):
            log(f"   {i}: {gate.name}({gate.qubits}) {f'params={gate.params}' if gate.params else ''}")
        
        # Create quantum circuit using Qiskit's native registers
        quantum_reg = QuantumRegister(req.num_qubits, 'q')
        classical_reg = ClassicalRegister(req.num_qubits, 'c')
        qc = QuantumCircuit(quantum_reg, classical_reg)
        
        # Apply all gates using Qiskit's native gate operations
        for gate in req.gates:
            g = gate.name.lower()
            q = gate.qubits
            p = gate.params or []
            
            # Debug: Show exactly what gate and qubits are being applied
            log(f"🎯 Applying gate {g} to qubits {q}")
            
            # Verify qubit indices are valid
            if any(qubit >= req.num_qubits or qubit < 0 for qubit in q):
                raise ValueError(f"Invalid qubit index in {q} for {req.num_qubits}-qubit circuit")
            
            try:
                # Single-qubit gates
                if g in ("h", "x", "y", "z", "s", "sdg", "t", "tdg", "i"):
                    if not q or len(q) < 1:
                        raise ValueError(f"Gate '{g}' requires 1 qubit index.")
                    if g == "i":  # Identity gate
                        qc.id(q[0])
                    else:
                        getattr(qc, g)(q[0])
                
                # Two-qubit gates
                elif g in ("cx", "cnot", "cz", "cy", "swap", "iswap", "ch", "ccx", "toffoli", "mcx"):
                    if g == "mcx":
                        if not q or len(q) < 3:
                            raise ValueError(f"Gate '{g}' requires at least 3 qubit indices (2+ controls + 1 target).")
                        # Multi-control X gate: all qubits except the last are controls, last is target
                        control_qubits = q[:-1]
                        target_qubit = q[-1]
                        qc.mcx(control_qubits, target_qubit)
                    elif g in ("ccx", "toffoli"):
                        if not q or len(q) < 3:
                            raise ValueError(f"Gate '{g}' requires 3 qubit indices.")
                        qc.ccx(q[0], q[1], q[2])  # Toffoli gate
                    else:
                        if not q or len(q) < 2:
                            raise ValueError(f"Gate '{g}' requires 2 qubit indices.")
                        if g in ("cx", "cnot"):
                            qc.cx(q[0], q[1])
                        elif g == "cz":
                            qc.cz(q[0], q[1])
                        elif g == "cy":
                            qc.cy(q[0], q[1])
                        elif g == "ch":
                            qc.ch(q[0], q[1])
                        elif g == "swap":
                            qc.swap(q[0], q[1])
                        elif g == "iswap":
                            if HAS_ISWAP:
                                qc.append(iSwapGate(), [q[0], q[1]])
                            else:
                                # Decompose iSWAP using Rx/Ry and CNOTs as a fallback
                                # iSWAP = exp(i*pi/4) * [CX, RZ(pi/2), CX, RZ(pi/2)] up to global phase
                                # Use a common decomposition pattern
                                qc.sx(q[0])
                                qc.sx(q[1])
                                qc.cx(q[0], q[1])
                                qc.rz(np.pi/2, q[0])
                                qc.rz(np.pi/2, q[1])
                                qc.cx(q[0], q[1])
                                qc.x(q[0])
                                qc.x(q[1])
                
                # Rotation gates (parameterized)
                elif g in ("rx", "ry", "rz", "p", "u1", "u2", "u3", "u"):
                    if not q or len(q) < 1:
                        raise ValueError(f"Gate '{g}' requires 1 qubit index.")
                    
                    # Controlled variants support: if multiple qubits are provided, treat all but last as controls
                    if g in ("rx", "ry", "rz", "u") and len(q) >= 2:
                        controls = q[:-1]
                        target = q[-1]
                        ctrl_count = len(controls)
                        if g in ("rx", "ry", "rz"):
                            if not p or len(p) < 1:
                                raise ValueError(f"Gate '{g}' requires 1 parameter.")
                            theta = p[0]
                            base_gate = RXGate(theta) if g == "rx" else (RYGate(theta) if g == "ry" else RZGate(theta))
                            qc.append(base_gate.control(ctrl_count), controls + [target])
                        elif g == "u":
                            if not p or len(p) < 3:
                                raise ValueError("Gate 'u' requires 3 parameters (theta, phi, lambda).")
                            base_gate = UGate(p[0], p[1], p[2])
                            qc.append(base_gate.control(ctrl_count), controls + [target])
                        continue
                    if g in ("rx", "ry", "rz", "p", "u1"):
                        if not p or len(p) < 1:
                            raise ValueError(f"Gate '{g}' requires 1 parameter.")
                        if g == "p":  # Phase gate
                            qc.p(p[0], q[0])
                        elif g == "u1":
                            qc.p(p[0], q[0])  # u1 is equivalent to p gate in modern Qiskit
                        else:
                            getattr(qc, g)(p[0], q[0])
                    elif g == "u2":
                        if not p or len(p) < 2:
                            raise ValueError(f"Gate '{g}' requires 2 parameters.")
                        qc.u(np.pi/2, p[0], p[1], q[0])  # u2 in terms of u gate
                    elif g == "u3":
                        if not p or len(p) < 3:
                            raise ValueError(f"Gate '{g}' requires 3 parameters.")
                        qc.u(p[0], p[1], p[2], q[0])  # Generic U gate
                    elif g == "u":
                        if not p or len(p) < 3:
                            raise ValueError(f"Gate '{g}' requires 3 parameters (theta, phi, lambda).")
                        qc.u(p[0], p[1], p[2], q[0])  # Generic U gate
                
                else:
                    raise ValueError(f"Unsupported gate: {gate.name}")
                    
            except Exception as e:
                return {"error": str(e), "gate": gate.dict()}
            
        # Get quantum state BEFORE measurement (for superposition visualization)
        state_circuit = qc.copy()  # Copy without measurement
        
        # Create noise model first (needed for state analysis)
        noise_model = create_noise_model(req.noise_params)
        
        # Get quantum state - handle both noiseless and noisy cases
        if HAS_AER and noise_model is not None:
            # For noisy simulation, use Aer SaveDensityMatrix instruction to capture pre-measurement state
            try:
                # Prefer the Aer-patched helper which is more version-resilient
                state_circuit.save_density_matrix()
            except Exception:
                # If not available, continue; we'll fall back to ideal statevector if needed
                pass

            state_simulator = AerSimulator(method='density_matrix', noise_model=noise_model)
            state_transpiled = transpile(state_circuit, state_simulator)
            state_result = state_simulator.run(state_transpiled).result()

            # Try to get the saved density matrix; if not present, fall back to pure statevector
            dm = None
            try:
                data0 = state_result.data(0)
                dm = data0.get('density_matrix')
            except Exception:
                dm = None

            if dm is not None:
                density_matrix = DensityMatrix(dm)
                statevector = None
                log("🔊 Using Aer saved density matrix for noisy pre-measurement state")
            else:
                # Fallback (rare): use ideal statevector as approximation
                statevector = Statevector.from_instruction(state_circuit)
                density_matrix = DensityMatrix(statevector)
                log("⚠️  No saved density matrix; using ideal statevector fallback")
        else:
            # For noiseless simulation or BasicSimulator fallback, use statevector
            statevector = Statevector.from_instruction(state_circuit)
            density_matrix = DensityMatrix(statevector)
            if HAS_AER:
                log(f"✨ Using statevector from noiseless simulation")
            else:
                log(f"⚠️  Using statevector from BasicSimulator fallback")
        
        # Calculate individual qubit probabilities and reduced density matrices
        qubit_probs = []
        qubit_states = []
        log(f"\n🎯 INDIVIDUAL QUBIT ANALYSIS FROM QUANTUM STATE:")
        
        for i in range(req.num_qubits):
            # Calculate probabilities - works for both statevector and density matrix
            if statevector is not None:
                prob_0 = statevector.probabilities([i])[0]  # Probability of |0⟩ for qubit i
                prob_1 = 1 - prob_0  # Probability of |1⟩ for qubit i
            else:
                # Extract from density matrix diagonal elements after partial trace
                other_qubits = [j for j in range(req.num_qubits) if j != i]
                if other_qubits:
                    reduced_dm = partial_trace(density_matrix, other_qubits)
                else:
                    reduced_dm = density_matrix
                dm_data = reduced_dm.data
                prob_0 = float(np.real(dm_data[0, 0]))
                prob_1 = float(np.real(dm_data[1, 1]))
            
            qubit_probs.append({"prob_0": float(prob_0), "prob_1": float(prob_1)})
            
            # Calculate reduced density matrix for this qubit using partial trace
            try:
                # Get indices of all qubits except the current one
                other_qubits = [j for j in range(req.num_qubits) if j != i]
                
                if other_qubits:
                    # Partial trace over all other qubits
                    reduced_dm = partial_trace(density_matrix, other_qubits)
                else:
                    # Single qubit case - no partial trace needed
                    reduced_dm = density_matrix
                
                # Extract the 2x2 density matrix
                dm_data = reduced_dm.data
                
                # For a single qubit, we can extract amplitudes from the density matrix
                # But for entangled states, the individual qubit may not have pure state amplitudes
                
                rho_00 = complex(dm_data[0, 0])
                rho_11 = complex(dm_data[1, 1])
                rho_01 = complex(dm_data[0, 1])
                rho_10 = complex(dm_data[1, 0])
                
                # Calculate purity robustly: Tr(ρ²) (1 for pure, <1 for mixed)
                try:
                    purity = float(np.real(np.trace(dm_data @ dm_data)))
                except Exception:
                    # Fallback to expanded form if matmul is unavailable for some reason
                    purity = float(np.real(rho_00*rho_00 + rho_01*rho_10 + rho_10*rho_01 + rho_11*rho_11))

                # Probabilities for |0> and |1> from diagonal elements
                prob_0_val = float(np.real(rho_00))
                prob_1_val = float(np.real(rho_11))

                # Bloch vector components from reduced density matrix
                # Convention aligned with frontend: x=2*Re(rho01), y=2*Im(rho01), z=rho00 - rho11
                bloch_x = float(2.0 * rho_01.real)
                bloch_y = float(2.0 * rho_01.imag)
                bloch_z = float(prob_0_val - prob_1_val)
                bloch_r = float(np.sqrt(bloch_x*bloch_x + bloch_y*bloch_y + bloch_z*bloch_z))
                # Polar angles; guard against divide by zero
                if bloch_r > 1e-12:
                    theta = float(np.degrees(np.arccos(max(-1.0, min(1.0, bloch_z / bloch_r)))))
                    phi = float(np.degrees(np.arctan2(bloch_y, bloch_x)))
                else:
                    theta = 90.0
                    phi = 0.0

                # For visualization helpers
                alpha_magnitude = float(np.sqrt(max(0.0, prob_0_val)))
                beta_magnitude = float(np.sqrt(max(0.0, prob_1_val)))

                # Decide mixed vs pure
                is_mixed = purity < 0.999
                is_maximally_mixed = is_mixed and bloch_r < 1e-3 and abs(prob_0_val - 0.5) < 0.01

                if is_mixed:
                    # Mixed states have no single well-defined relative phase; provide amplitudes without phase
                    qubit_state = {
                        "amplitude0": {"real": float(alpha_magnitude), "imag": 0.0},
                        "amplitude1": {"real": float(beta_magnitude), "imag": 0.0},
                        "is_mixed": True,
                        "is_maximally_mixed": is_maximally_mixed,
                        "purity": purity,
                        "prob_0": prob_0_val,
                        "prob_1": prob_1_val,
                        "bloch": {
                            "x": bloch_x,
                            "y": bloch_y,
                            "z": bloch_z,
                            "r": bloch_r,
                            "theta": theta,
                            "phi": phi,
                        },
                        "density_matrix": {
                            "rho_00": {"real": float(rho_00.real), "imag": float(rho_00.imag)},
                            "rho_01": {"real": float(rho_01.real), "imag": float(rho_01.imag)},
                            "rho_10": {"real": float(rho_10.real), "imag": float(rho_10.imag)},
                            "rho_11": {"real": float(rho_11.real), "imag": float(rho_11.imag)}
                        }
                    }
                    if is_maximally_mixed:
                        log(f"        Mixed state (maximally mixed, purity={purity:.3f})")
                    else:
                        log(f"        Partially mixed state (purity={purity:.3f})")
                else:
                    # Pure state - extract phase from off-diagonal elements
                    if abs(rho_01) > 1e-10 and beta_magnitude > 1e-10 and alpha_magnitude > 1e-10:
                        # Phase of β relative to α
                        relative_phase = float(np.angle(rho_01 / (alpha_magnitude * beta_magnitude)))
                        beta_real = beta_magnitude * np.cos(relative_phase)
                        beta_imag = beta_magnitude * np.sin(relative_phase)
                    else:
                        beta_real = beta_magnitude
                        beta_imag = 0.0
                    
                    qubit_state = {
                        "amplitude0": {"real": float(alpha_magnitude), "imag": 0.0},
                        "amplitude1": {"real": float(beta_real), "imag": float(beta_imag)},
                        "is_mixed": False,
                        "purity": purity,
                        "prob_0": prob_0_val,
                        "prob_1": prob_1_val,
                        "bloch": {
                            "x": bloch_x,
                            "y": bloch_y,
                            "z": bloch_z,
                            "r": bloch_r,
                            "theta": theta,
                            "phi": phi,
                        },
                        "density_matrix": {
                            "rho_00": {"real": float(rho_00.real), "imag": float(rho_00.imag)},
                            "rho_01": {"real": float(rho_01.real), "imag": float(rho_01.imag)},
                            "rho_10": {"real": float(rho_10.real), "imag": float(rho_10.imag)},
                            "rho_11": {"real": float(rho_11.real), "imag": float(rho_11.imag)}
                        }
                    }
                    log(f"        Pure state (purity={purity:.3f})")
                    log(f"        α = {alpha_magnitude:.3f}, β = {beta_real:.3f} + {beta_imag:.3f}i")
                
                qubit_states.append(qubit_state)
                log(f"   q{i}: |0⟩={prob_0:.3f} ({prob_0*100:.1f}%), |1⟩={prob_1:.3f} ({prob_1*100:.1f}%)")
                
            except Exception as e:
                log(f"   Error calculating reduced density matrix for q{i}: {e}")
                # Fallback to simple probability-based amplitudes
                qubit_state = {
                    "amplitude0": {"real": float(np.sqrt(prob_0)), "imag": 0.0},
                    "amplitude1": {"real": float(np.sqrt(prob_1)), "imag": 0.0}
                }
                qubit_states.append(qubit_state)
                log(f"   q{i}: |0⟩={prob_0:.3f} ({prob_0*100:.1f}%), |1⟩={prob_1:.3f} ({prob_1*100:.1f}%) [fallback]")
        
        # Now add measurement and simulate
        qc.measure(quantum_reg, classical_reg)
        
        # Choose appropriate simulator based on availability and noise
        backend_name = ""
        if HAS_AER:
            if noise_model is not None:
                # Use density matrix simulator for noisy simulations
                simulator = AerSimulator(method='density_matrix', noise_model=noise_model)
                log(f"\n🔊 Using AerSimulator with density matrix method and noise model")
                backend_name = "aer_density_matrix"
            else:
                # Use statevector simulator for noiseless simulations (faster)
                simulator = AerSimulator(method='statevector')
                log(f"\n✨ Using AerSimulator with statevector method (noiseless)")
                backend_name = "aer_statevector"
        else:
            # Fallback to BasicSimulator
            simulator = BasicSimulator()
            log(f"\n⚠️  Using BasicSimulator (Aer unavailable)")
            backend_name = "basic_simulator"
            if req.noise_params.noise_enabled:
                log(f"🚫 Noise simulation requested but Aer not available - running noiseless")
        
        transpiled_circuit = transpile(qc, simulator)
        job = simulator.run(transpiled_circuit, shots=req.shots or 1024)
        result = job.result()
        counts = result.get_counts()

        # Debug: Log the measurement results from Qiskit
        log(f"\n🔎 QISKIT SIMULATION RESULTS:")
        log(f"🔬 Measurement results: {counts}")
        log(f"🔬 Total shots: {sum(counts.values())}")
        log(f"🔬 Number of unique outcomes: {len(counts)}")
        log(f"🔬 Gates applied: {[f'{g.name}({g.qubits})' for g in req.gates]}")
        if noise_model and HAS_AER:
            try:
                log(f"🔊 Noise model active with {len(noise_model.noise_qubits)} noisy qubits")
            except AttributeError:
                log(f"🔊 Noise model active (qubits info unavailable)")

        # Debug: Detailed bitstring interpretation
        log(f"\n🔍 BITSTRING INTERPRETATION (Qiskit little-endian format):")
        log("   Bitstring → Qubit States → Probability")
        for bitstring, count in sorted(counts.items()):
            probability = (count / (req.shots or 1024)) * 100
            qubit_labels = []
            # In Qiskit's little-endian: rightmost bit is q0, leftmost is highest qubit
            for i, bit in enumerate(reversed(bitstring)):
                qubit_labels.append(f"q{i}={bit}")
            log(f"   {bitstring} → {' '.join(qubit_labels)} → {probability:.1f}% ({count} counts)")
        
        log("="*60 + "\n")
        

        # Get circuit depth and gate count (Qiskit metrics)
        circuit_depth = qc.depth()
        gate_count = len(qc.data)
        
        # Convert statevector to serializable format (handle None case)
        statevector_data = []
        if statevector is not None:
            for amplitude in statevector.data:
                statevector_data.append({
                    "real": float(amplitude.real),
                    "imag": float(amplitude.imag)
                })
        else:
            # For noisy simulations, we don't have a pure statevector
            # Generate a placeholder or extract from density matrix if needed
            log("⚠️  No statevector available for noisy simulation")

        # QSPhere fallback: when no statevector (noisy/mixed), provide basis probabilities
        # Limit to a safe size to avoid huge payloads
        qsphere_probabilities = None
        qsphere_available = False
        try:
            if statevector is None and density_matrix is not None:
                n = req.num_qubits
                # Only include for manageable sizes (<= 12 qubits => 4096 entries)
                if n <= 12:
                    diag = np.real(np.diag(density_matrix.data))
                    # Normalize small numerical drift
                    diag = np.clip(diag, 0.0, 1.0)
                    total = float(np.sum(diag))
                    if total > 0:
                        diag = diag / total
                    qsphere_probabilities = {}
                    # Map index -> bitstring (Qiskit uses little-endian for counts display; keep consistency with counts keys)
                    # We'll generate bitstrings in the same order as counts (little-endian string with q0 on the right)
                    num_states = 1 << n
                    for idx in range(num_states):
                        bitstring = format(idx, f"0{n}b")
                        # Qiskit prints bitstrings big-endian (left-most highest qubit); indices follow computational basis
                        # To align with counts keys, keep this as-is; frontend may reverse for display like counts
                        prob = float(diag[idx])
                        if prob > 0.0:
                            qsphere_probabilities[bitstring] = prob
                    qsphere_available = True
                else:
                    log(f"ℹ️  Skipping qsphere_probabilities for {n} qubits (payload too large)")
        except Exception as e:
            log(f"⚠️  Failed to build qsphere_probabilities: {e}")
        
        return {
            "counts": counts,
            "qubit_probabilities": qubit_probs,  # Individual qubit probabilities for UI
            "qubit_states": qubit_states,  # Individual qubit amplitudes and density matrices
            "statevector": statevector_data,  # Full statevector for authentic amplitude display
            "qsphere_probabilities": qsphere_probabilities,
            "qsphere_available": qsphere_available,
            "shots": req.shots or 1024,
            "backend": backend_name,
            "circuit_depth": circuit_depth,
            "gate_count": gate_count,
            "num_qubits": req.num_qubits,
            "transpiled_depth": transpiled_circuit.depth(),
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/circuit-info")
def get_circuit_info(req: CircuitRequest):
    """Get detailed circuit information without simulation"""
    try:
        # Create the circuit using pure Qiskit
        quantum_reg = QuantumRegister(req.num_qubits, 'q')
        classical_reg = ClassicalRegister(req.num_qubits, 'c')
        qc = QuantumCircuit(quantum_reg, classical_reg)
        
        # Build circuit with Qiskit gates
        for gate in req.gates:
            g = gate.name.lower()
            q = gate.qubits
            p = gate.params or []
            
            # Apply the same gate logic as simulation
            if g in ("h", "x", "y", "z", "s", "sdg", "t", "tdg", "i"):
                if g == "i":
                    qc.id(q[0])
                else:
                    getattr(qc, g)(q[0])
            elif g in ("cx", "cnot"):
                qc.cx(q[0], q[1])
            elif g in ("cz", "cy", "swap", "ch"):
                if g == "cz":
                    qc.cz(q[0], q[1])
                elif g == "cy":
                    qc.cy(q[0], q[1])
                elif g == "ch":
                    qc.ch(q[0], q[1])
                elif g == "swap":
                    qc.swap(q[0], q[1])
            elif g in ("ccx", "toffoli"):
                qc.ccx(q[0], q[1], q[2])
            elif g in ("rx", "ry", "rz", "p", "u1"):
                if g == "p":
                    qc.p(p[0], q[0])
                elif g == "u1":
                    qc.p(p[0], q[0])
                else:
                    getattr(qc, g)(p[0], q[0])
            elif g == "u":
                qc.u(p[0], p[1], p[2], q[0])
            # Add more gates as needed
        
        # Get Qiskit circuit properties
        return {
            "depth": qc.depth(),
            "width": qc.width(),
            "size": qc.size(),
            "gate_count": len(qc.data),
            "num_qubits": qc.num_qubits,
            "num_clbits": qc.num_clbits,
            "gates": [{"name": gate[0].name, "qubits": [qc.find_bit(qubit).index for qubit in gate[1]]} for gate in qc.data],
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/test-noise")
def test_noise_effects(req: CircuitRequest):
    """
    Test the same circuit with and without noise to compare results
    """
    try:
        # Run without noise
        noiseless_req = req.copy()
        noiseless_req.noise_params.noise_enabled = False
        noiseless_result = simulate_circuit(noiseless_req)
        
        # Run with noise
        noisy_req = req.copy()
        noisy_req.noise_params.noise_enabled = True
        noisy_result = simulate_circuit(noisy_req)
        
        return {
            "noiseless": noiseless_result,
            "noisy": noisy_result,
            "noise_params": req.noise_params.dict()
        }
    
    except Exception as e:
        return {"error": f"Noise comparison failed: {str(e)}"}

@app.get("/noise-presets")
def get_noise_presets():
    """
    Get predefined noise configurations for different scenarios
    """
    presets = {
        "superconducting_low_noise": NoiseParameters(
            noise_enabled=True,
            depolarizing_prob=0.0001,
            t1_time=100.0,
            t2_time=150.0,
            readout_error_prob=0.005,
            gate_time=0.05,
            thermal_population=0.01
        ),
        "superconducting_high_noise": NoiseParameters(
            noise_enabled=True,
            depolarizing_prob=0.01,
            t1_time=20.0,
            t2_time=30.0,
            readout_error_prob=0.05,
            gate_time=0.2,
            thermal_population=0.1
        ),
        "trapped_ion": NoiseParameters(
            noise_enabled=True,
            depolarizing_prob=0.0001,
            t1_time=10000.0,
            t2_time=1000.0,
            readout_error_prob=0.001,
            gate_time=10.0,
            thermal_population=0.001
        ),
        "photonic": NoiseParameters(
            noise_enabled=True,
            depolarizing_prob=0.001,
            t1_time=1000.0,
            t2_time=2000.0,
            readout_error_prob=0.1,
            gate_time=1.0,
            thermal_population=0.0
        )
    }
    
    return {
        "presets": {name: preset.dict() for name, preset in presets.items()},
        "description": {
            "superconducting_low_noise": "IBM-style superconducting qubits (good quality)",
            "superconducting_high_noise": "Noisy superconducting qubits (early NISQ era)", 
            "trapped_ion": "Trapped ion qubits (high coherence)",
            "photonic": "Photonic qubits (loss-dominated errors)"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
