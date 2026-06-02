import numpy as np
from qiskit import QuantumCircuit, transpile
from qiskit_aer import AerSimulator
from qiskit.circuit.library import QFT, UnitaryGate
from qiskit.quantum_info import Operator
from qiskit.visualization import plot_histogram
import matplotlib.pyplot as plt
from collections import Counter


# This function creates a 16x16 permutation matrix representing our math.
# It calculates f(x) = (x * a^power) mod N
def mod_exp_matrix(a, power, N, n_target):
    size = 2**n_target 
    matrix = np.zeros((size, size))
    
    for i in range(size):
        if i < N:

            val = (i * (a**power)) % N
            matrix[val, i] = 1 
        else:

            matrix[i, i] = 1 
            
    return matrix
N = 15
a = 7

n_target = 8
n_count = 16

qc = QuantumCircuit(n_count + n_target, n_count)

for q in range(n_count):
    qc.h(q)

qc.x(n_count) 

print(f"Building controlled unitary gates for a={a}, N={N}...")

print(f"Building controlled unitary gates for a={a}, N={N}...")

for q in range(n_count):
    power = 2**q 
    matrix = mod_exp_matrix(a, power, N, n_target)
    
    base_gate = UnitaryGate(matrix)
    
    controlled_matrix = Operator(base_gate.control(1)).to_matrix()
    
    flat_gate = UnitaryGate(controlled_matrix)
    
    qc.append(flat_gate, [q] + list(range(n_count, n_count + n_target)))
iqft = QFT(num_qubits=n_count, inverse=True, do_swaps=True).to_gate()
iqft.name = "IQFT_Shors_demo"
qc.append(iqft, range(n_count))

qc.measure(range(n_count), range(n_count))

qc.draw(output='mpl', filename='cir.png')
print(qc.draw(output='text'))
print("Transpiling and running circuit...")
backend = AerSimulator(method='matrix_product_state')

transpiled_qc = transpile(qc, backend)

job = backend.run(transpiled_qc, shots=1024)
results = job.result()
counts = results.get_counts()

print("\nSimulation complete! Measurement counts:")
counter = Counter(counts)
print(counts)
high = counter.most_common(1)
print(f"The higgest score ; {high[0]}")

plot_histogram(counts)
plt.title(f"Shor's Algorithm Outcomes for N={N}, a={a}")
plt.show()
