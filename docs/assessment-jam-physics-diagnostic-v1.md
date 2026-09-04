# JAM Physics Diagnostic — Question Bank v1 (for review)

**Status:** draft — to be finalized, then loaded via the admin panel (or `prisma/seed.ts`).
**Test:** `jam-physics-diagnostic` · 20 CONTENT questions · single-correct · suggested 20–25 min.
**Marks:** `4` per question, `1` negative (matches existing seed). See "Scoring notes" for an alternative.

---

## 1. What JAM Physics actually asks (analysis of PH 2024 & PH 2025 papers)

> PH 2025 is a scanned PDF with no text layer, so the detailed read below is from **PH 2024**;
> the pattern, syllabus weighting and difficulty band are unchanged year to year and PH 2025
> follows the same three-section structure.

### Paper structure (60 questions, 100 marks, 3 hours)
| Section | Type | Count | Marks | Negative |
|---|---|---|---|---|
| A | MCQ, single correct | 30 | 10×1 + 20×2 | 1/3 (1-mark), 2/3 (2-mark) |
| B | MSQ, one or more correct | 10 | 2 each | none (all-or-nothing) |
| C | NAT, type-in numerical value | 20 | 10×1 + 10×2 | none |

### Syllabus coverage seen in PH 2024 (representative, ~every topic every year)
- **Mathematical Physics** — vector calculus (divergence/curl/line & surface integrals, Stokes),
  matrices (Hermitian, unitary), roots of polynomials / complex variable, Taylor expansion,
  Jacobian of a coordinate transform, area via cross product.
- **Mechanics & properties of matter** — central forces & orbits (parabolic/elliptic, closest
  approach), rotational dynamics (moment of inertia, torque, parallel-axis), fluid mechanics
  (Bernoulli / Torricelli, continuity, efflux), collisions & coefficient of restitution,
  projectile trajectories.
- **Oscillations, Waves & Optics** — damped/critically-damped oscillators, superposition &
  standing waves, beats / carrier frequency, group vs phase velocity in a dispersive medium,
  interference (Newton's rings), diffraction gratings & resolving power, polarization
  (Brewster angle, retarding / quarter-wave plates, birefringence), thick-lens & silvered-lens
  imaging.
- **Electricity & Magnetism** — Gauss's law, dielectrics & boundary conditions, displacement
  vector `D`, bound/induced charge, electrostatic field as curl-free, EM induction (solenoid
  with time-varying B → induced E), LCR resonance, Poynting vector / EM-wave fields, Brewster.
- **Kinetic theory & Thermodynamics** — first law on P–V cycles (adiabatic + isochoric engine,
  efficiency), entropy change over a cycle / over heating steps, C_p/C_v from degrees of
  freedom, mean free path & mean collision time vs T at constant P, isothermal vs isobaric
  work and ΔU.
- **Modern Physics** — special relativity (time dilation, length contraction, **simultaneity**,
  relativistic KE↔speed), quantum (infinite square well scaling with mass, probability density
  ↔ potential), photoelectric / Compton (shift vs angle, max shift), blackbody & the UV
  catastrophe (equipartition), Fermi–Dirac occupation probability, nuclear reactions & Q-value.
- **Solid State, Devices & Electronics** — crystal structure (NaCl ion count, hcp basis,
  Miller indices), Bragg diffraction order & spacing, semiconductors (n-/p-type dopants, p–n
  depletion widths, Zener regulation), BJT biasing & I_C, op-amp configs (inverting /
  difference / gain), logic gates & binary arithmetic.

### Difficulty band
- **1-mark MCQs**: one-step recall or a single concept ("ions per NaCl cell", "which dopant
  gives n-type", "what causes the UV catastrophe").
- **2-mark MCQ/MSQ**: 2–4 linked steps or a multi-part concept check, still ~2–5 min with paper.
- **NAT**: plug-and-chug with a calculator, 3–6 lines of working.
- Nothing requires a "trick"; it rewards a student who knows definitions cold and can apply
  one or two standard results without hesitating.

### What our diagnostic does differently (by design)
This test is a **preparedness estimator**, not a JAM mock. Every question is answerable in
under a minute **without pen and paper** — it probes whether the underlying concept is in
place ("does the student know *why* the ground-state energy of a box isn't zero"), not
whether they can grind an integral. If a student reliably gets the medium ones right, they
have the conceptual base JAM is built on; the calculation speed is a separate, later drill.

---

## 2. Topic & difficulty spread of the 20 questions

| Topic (matches `config/site.ts` `suggestedPhysicsTopics`) | Qs | Easy | Medium | Hard |
|---|---|---|---|---|
| Mathematical Physics | 2 | 1 | 1 | – |
| Mechanics | 1 | 1 | – | – |
| Rotational Mechanics | 1 | – | 1 | – |
| Waves & Oscillations | 1 | – | 1 | – |
| Optics | 2 | 1 | 1 | – |
| Electricity & Magnetism | 2 | 1 | 1 | – |
| Electromagnetic Theory | 1 | – | – | 1 |
| Thermodynamics & Statistical Mechanics | 3 | 1 | 2 | – |
| Modern Physics | 3 | 1 | 1 | 1 |
| Quantum Mechanics | 1 | – | 1 | – |
| Solid State Physics | 3 | 2 | 1 | – |
| **Total** | **20** | **9** | **9** | **2** |

Deliberately easy-leaning: a well-prepared student should clear ~15–17; a beginner still gets
the ~9 easy ones and doesn't bounce off the test. The 2 hard items are still conceptual
(no computation), just less commonly drilled.

Legend: **E** = recall / one concept · **M** = links 2–3 concepts · **H** = subtle, commonly
misremembered.

---

## 3. The questions

> Format per item: topic · difficulty · prompt · options (correct marked ✅) · why it's a good
> discriminator. Math is written for KaTeX (`$...$`), which the runner already renders.

### Q1 — Mathematical Physics · E
**Prompt:** A Hermitian operator representing a physical observable is guaranteed to have:
- A. Real eigenvalues, and eigenvectors belonging to different eigenvalues are orthogonal ✅
- B. Complex eigenvalues that occur in conjugate pairs
- C. Determinant equal to 1
- D. A purely imaginary trace

*Discriminator:* the single most-used fact in QM. A student who's shaky here hasn't
internalized why observables are Hermitian.

### Q2 — Mathematical Physics · M
**Prompt:** For the position vector $\vec{r} = x\,\hat{x} + y\,\hat{y} + z\,\hat{z}$, the
divergence $\nabla \cdot \vec{r}$ in three-dimensional space is:
- A. $0$
- B. $1$
- C. $3$ ✅
- D. $\hat{r}/r^2$

*Discriminator:* trivial once you actually apply the definition; students who pattern-match
"radial field ⇒ divergence zero" (confusing it with $\hat{r}/r^2$) get it wrong.

### Q3 — Mechanics · E
**Prompt:** A particle moves under a central force directed toward a fixed point O. Which
quantity is always conserved?
- A. Its linear momentum
- B. Its angular momentum about O ✅
- C. Its kinetic energy
- D. Its speed

*Discriminator:* the defining property of central-force motion (and the reason orbits are
planar / Kepler's second law). Distractors A and D are what students pick if they conflate
"central" with "constant".

### Q4 — Rotational Mechanics · M
**Prompt:** A solid sphere and a hollow sphere of the **same mass and radius** are released
from rest and roll without slipping down the same incline. Which reaches the bottom first?
- A. The solid sphere ✅
- B. The hollow sphere
- C. They arrive together
- D. It depends on the mass

*Discriminator:* tests whether the student knows the acceleration depends on $I/mR^2$ (mass
distribution), not on mass or radius — and can rank $\tfrac{2}{5}$ vs $\tfrac{2}{3}$ without
computing.

### Q5 — Waves & Oscillations · M
**Prompt:** In a **non-dispersive** medium, the group velocity of a wave packet is:
- A. Zero
- B. Equal to the phase velocity ✅
- C. Always greater than the phase velocity
- D. Equal to the speed of light in vacuum

*Discriminator:* "dispersion ⇔ $v_g \ne v_p$" is a JAM staple (they usually give a dispersive
$n(\lambda)$ and ask where the two are equal). This checks the baseline case.

### Q6 — Optics · E
**Prompt:** Unpolarized light reflecting off a dielectric surface becomes **completely
linearly polarized** when the angle of incidence equals the:
- A. Critical angle
- B. Brewster angle ✅
- C. Bragg angle
- D. Grazing angle

*Discriminator:* pure recall, but a very common JAM entry point into a polarization problem.

### Q7 — Optics · M
**Prompt:** When light is incident at Brewster's angle on an interface, the angle between the
reflected ray and the refracted ray is:
- A. $0^\circ$
- B. $45^\circ$
- C. $90^\circ$ ✅
- D. $180^\circ$

*Discriminator:* the geometric fact behind $\tan\theta_B = n_2/n_1$. JAM 2024 Q7 asked exactly
this angle (with refraction indices given); here it's stripped to the concept.

### Q8 — Electricity & Magnetism · E
**Prompt:** The net electric flux through a closed surface depends on:
- A. Only the total charge enclosed by the surface ✅
- B. The total charge enclosed **and** nearby external charges
- C. The shape of the surface
- D. The position of the charges within the surface

*Discriminator:* Gauss's law in words. Distractor B is the classic misconception (external
charges change the *field* on the surface but not the *flux*).

### Q9 — Electricity & Magnetism · M
**Prompt:** Just outside the surface of a charged conductor in electrostatic equilibrium, the
electric field is:
- A. Zero
- B. Parallel to the surface
- C. Perpendicular to the surface ✅
- D. At $45^\circ$ to the surface

*Discriminator:* if there were a tangential component, charges would still be moving — so it's
purely normal, magnitude $\sigma/\varepsilon_0$. Tests the equilibrium argument, not a formula.

### Q10 — Electromagnetic Theory · H
**Prompt:** At a charge-free boundary between two linear dielectrics, which field components
are continuous across the interface?
- A. The tangential component of $\vec{E}$ and the normal component of $\vec{D}$ ✅
- B. The normal component of $\vec{E}$ and the tangential component of $\vec{D}$
- C. Both components of $\vec{E}$
- D. Both components of $\vec{D}$

*Discriminator:* students routinely swap which field is continuous in which direction. JAM 2024
Q23 was a numerical version of this exact boundary condition.

### Q11 — Thermodynamics & Statistical Mechanics · E
**Prompt:** The efficiency of a Carnot engine depends on:
- A. The working substance used
- B. Only the temperatures of the hot and cold reservoirs ✅
- C. The number of moles of gas
- D. The volume at the start of the cycle

*Discriminator:* $\eta = 1 - T_c/T_h$. The "working substance independence" is the conceptual
payload of Carnot's theorem.

### Q12 — Thermodynamics & Statistical Mechanics · M
**Prompt:** For an ideal gas of **rigid diatomic** molecules (3 translational + 2 rotational
degrees of freedom), the ratio $\gamma = C_p/C_V$ is:
- A. $5/3$
- B. $7/5$ ✅
- C. $4/3$
- D. $3/2$

*Discriminator:* tests the equipartition chain: $f=5 \Rightarrow C_V = \tfrac{5}{2}R
\Rightarrow \gamma = 7/5$. JAM 2024 Q28 asked the same for $f = 6$ (answer $4/3$).

### Q13 — Thermodynamics & Statistical Mechanics · M
**Prompt:** An ideal gas undergoes free expansion into an evacuated chamber (rigid, insulated
container). Which quantity does **not** change?
- A. Temperature ✅
- B. Entropy
- C. Volume
- D. The number of accessible microstates

*Discriminator:* $W = 0$, $Q = 0 \Rightarrow \Delta U = 0 \Rightarrow \Delta T = 0$ for an
ideal gas — yet entropy rises (irreversible). Catches students who think "no heat ⇒ no entropy
change".

### Q14 — Modern Physics · E
**Prompt:** In the photoelectric effect, increasing the **intensity** of the incident light
(frequency fixed, above threshold) increases:
- A. The maximum kinetic energy of the emitted electrons
- B. The number of electrons emitted per second ✅
- C. The work function of the metal
- D. The threshold frequency

*Discriminator:* the intensity-vs-frequency distinction is the whole point of Einstein's
explanation. (Mirrors the seed's existing photoelectric item — keep whichever you prefer.)

### Q15 — Modern Physics · M
**Prompt:** In Compton scattering, the shift in wavelength $\Delta\lambda$ for a fixed
scattering angle:
- A. Increases with the incident wavelength
- B. Decreases with the incident wavelength
- C. Is independent of the incident wavelength ✅
- D. Depends on the intensity of the incident radiation

*Discriminator:* $\Delta\lambda = \frac{h}{m_e c}(1-\cos\theta)$ — angle only. JAM 2024 Q34
leaned on this (max shift at $\theta = 180^\circ$, same $\Delta\lambda$ for X-rays and
$\gamma$-rays).

### Q16 — Modern Physics · H
**Prompt:** Two events occur simultaneously at different locations in inertial frame S. In a
second inertial frame S′ moving relative to S along the line joining the events:
- A. The events are still simultaneous
- B. The events are, in general, **not** simultaneous ✅
- C. The events occur at the same location
- D. One event does not occur at all

*Discriminator:* relativity of simultaneity — routinely under-taught. JAM 2024 Q36 built a
whole numerical on "two simultaneous events in one frame" → time interval in the other.

### Q17 — Quantum Mechanics · M
**Prompt:** The ground-state energy of a particle in a one-dimensional infinite square well is
**not zero** primarily because:
- A. The Heisenberg uncertainty principle forbids a confined particle from having zero
  momentum spread ✅
- B. The particle is always in motion due to friction with the walls
- C. Gravitational potential energy sets a minimum
- D. The walls are at a finite, non-zero temperature

*Discriminator:* the zero-point energy ↔ confinement ↔ uncertainty link. A student who's only
memorized $E_n \propto n^2$ often can't say *why* $n$ starts at 1.

### Q18 — Solid State Physics · E
**Prompt:** Doping pure silicon with phosphorus (a group-V element) produces:
- A. An n-type semiconductor ✅
- B. A p-type semiconductor
- C. An insulator
- D. A superconductor

*Discriminator:* one-step recall; JAM 2024 Q31 asked precisely which dopants give n-type
(P, As, Sb vs In). Distractor B catches students who reverse donor/acceptor.

### Q19 — Solid State Physics (Electronics) · E
**Prompt:** The output of a two-input NAND gate is LOW only when:
- A. Both inputs are LOW
- B. Both inputs are HIGH ✅
- C. Exactly one input is HIGH
- D. Either input is LOW

*Discriminator:* basic digital logic (JAM 2024 Q13 was a gate-identification question). Fast
confidence check for the electronics segment.

### Q20 — Solid State Physics (Nuclear) · M
**Prompt:** The binding energy per nucleon is largest for nuclei near mass number $A \approx
56$ (iron/nickel). This implies:
- A. Energy is released both when very light nuclei fuse and when very heavy nuclei fission ✅
- B. Energy is released only in fusion, never in fission
- C. Iron nuclei readily undergo spontaneous fission
- D. Heavy nuclei are more tightly bound than iron

*Discriminator:* reading the binding-energy curve — the single most important idea in nuclear
physics. Distractor D is the literal misreading of "binding energy" vs "binding energy per
nucleon".

---

## 4. Answer key (quick reference)

| Q | Topic | Diff | Answer |
|---|---|---|---|
| 1 | Mathematical Physics | E | A |
| 2 | Mathematical Physics | M | C |
| 3 | Mechanics | E | B |
| 4 | Rotational Mechanics | M | A |
| 5 | Waves & Oscillations | M | B |
| 6 | Optics | E | B |
| 7 | Optics | M | C |
| 8 | Electricity & Magnetism | E | A |
| 9 | Electricity & Magnetism | M | C |
| 10 | Electromagnetic Theory | H | A |
| 11 | Thermodynamics & Statistical Mechanics | E | B |
| 12 | Thermodynamics & Statistical Mechanics | M | B |
| 13 | Thermodynamics & Statistical Mechanics | M | A |
| 14 | Modern Physics | E | B |
| 15 | Modern Physics | M | C |
| 16 | Modern Physics | H | B |
| 17 | Quantum Mechanics | M | A |
| 18 | Solid State Physics | E | A |
| 19 | Solid State Physics | E | B |
| 20 | Solid State Physics | M | A |

---

## 5. Scoring notes / open decisions before finalizing

1. **Negative marking.** The current engine uses `marks: 4, negativeMarks: 1` uniformly. For a
   *diagnostic* (we want an honest signal, not exam nerves) consider `negativeMarks: 0`, or
   `0` on the 9 easy items and `1` on the rest. Changing this is a per-question field edit.
2. **Difficulty isn't stored.** There's no `difficulty` column on `AssessmentQuestion`. If we
   want the results page to say "you're solid on the fundamentals but missed the harder
   conceptual ones", we'd either (a) add a `difficulty` field, or (b) encode it in `topic`
   (ugly), or (c) keep it here in docs only and infer nothing. Recommend (a) — one enum column.
3. **Option order.** Answers above are spread but not shuffled per-attempt; the runner shows
   options in stored order. Fine for v1.
4. **Overlap with seed placeholders.** `prisma/seed.ts` currently seeds 6 placeholder CONTENT
   questions (circular-motion acceleration, SHM energy, uniformly charged sphere field, Lorentz
   force direction, adiabatic ⇒ isentropic, photoelectric intensity, Fourier series). Q14 here
   overlaps the photoelectric one — decide whether to replace the seed set entirely with these
   20 or keep a few.
5. **Count.** 20 is the top of your 15–20 range. If you want a 15-minute test, the natural cut
   to 15 is: drop Q2, Q5, Q10, Q16, Q20 (keeps every topic represented, removes both hard ones
   and the longer-to-read ones).
6. **PROFILE questions** (year, prep level) already exist in the seed and are unchanged.

Once you've marked up this file, I can emit it as a `prisma/seed.ts` block or as
`createQuestion` payloads for the admin action.
