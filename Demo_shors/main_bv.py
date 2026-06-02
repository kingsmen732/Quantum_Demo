import time
from qiskit import QuantumCircuit, transpile
from qiskit_aer import AerSimulator
from qiskit.visualization import plot_histogram
import matplotlib.pyplot as plt

secret_string = "1011010010111000110101101010001110101011000101101" 

n_qubits = len(secret_string) 
qc = QuantumCircuit(n_qubits + 1, n_qubits)

qc.x(n_qubits)
qc.h(n_qubits)

for q in range(n_qubits):
    qc.h(q)

qc.barrier()

secret_reversed = secret_string[::-1] 
for q in range(n_qubits):
    if secret_reversed[q] == '1':
        qc.cx(q, n_qubits) 

qc.barrier()

for q in range(n_qubits):
    qc.h(q)

qc.measure(range(n_qubits), range(n_qubits))

print(f"Executing Bernstein-Vazirani for {n_qubits + 1} total qubits...")
print(f"Bypassing the RAM limit using Matrix Product States (MPS)...")

start_time = time.time()

backend = AerSimulator(method='matrix_product_state')

transpiled_qc = transpile(qc, backend, optimization_level=1)

job = backend.run(transpiled_qc, shots=1) 
result = job.result()
counts = result.get_counts()

end_time = time.time()

print(qc.draw(output='text'))
print(f"\nSimulation Complete in {end_time - start_time:.2f} seconds!")
print(f"Target String:   {secret_string}")
print(f"Measured Result: {list(counts.keys())[0]}")

if list(counts.keys())[0] == secret_string:
    print("simulation executed flawlessly in 1 shot!")

plot_histogram(counts, figsize=(15,6))
plt.title("Bernstein-Vazirani 50QU")
plt.show()