// Workout routine. Edit names, target reps, or notes here.
// Exercises that share an `id` share history.
// Optional `search` replaces `name` in the YouTube form search.
const SCHEDULE = [
  {
    id: "day1",
    name: "Day 1",
    focus: "Chest, Tricep",
    exercises: [
      { id: "flat-db-press", name: "Flat Dumbbell Press", reps: [12, 10, 10, 8] },
      { id: "incline-db-press", name: "Incline Dumbbell Press", reps: [12, 10, 10, 8] },
      { id: "incline-flys", name: "Incline Flys", reps: [12, 10, 10, 8], search: "incline dumbbell fly" },
      { id: "pec-deck", name: "Pec Deck", reps: [10, 10, 10, 10] },
      { id: "tricep-pushdown", name: "Tricep Pushdown", reps: [12, 12, 12, 12] },
      { id: "tricep-overhead-ext", name: "Tricep Overhead Extension", reps: [12, 12, 12, 12] },
      { id: "cable-tricep-push", name: "Cable Tricep Push", reps: [12, 12, 12, 12], search: "cable tricep pushdown" },
    ],
  },
  {
    id: "day2",
    name: "Day 2",
    focus: "Back, Bicep",
    exercises: [
      { id: "lat-pulldown", name: "Lat Pulldown", reps: [12, 12, 12, 12] },
      { id: "barbell-row", name: "Barbell Rowing", reps: [12, 12, 12, 12], search: "barbell bent over row" },
      { id: "single-arm-rope-push", name: "Single Arm Rope Push", reps: [12, 12, 12, 12], search: "single arm cable rope pushdown" },
      { id: "traps", name: "Traps", reps: [12, 12, 12, 12], note: "Hold 2 sec at top", search: "shrugs traps" },
      { id: "bicep-curl", name: "Bicep Curl", reps: [12, 12, 12, 12] },
      { id: "preacher-curl", name: "Preacher Curl", reps: [12, 10, 10, 10] },
      { id: "hammer-curl", name: "Hammer Curl", reps: [12, 12, 12, 12] },
    ],
  },
  {
    id: "day3",
    name: "Day 3",
    focus: "Legs, Shoulders",
    exercises: [
      { id: "squat", name: "Squat", reps: [12, 12, 12, 12], search: "barbell squat" },
      { id: "leg-extension", name: "Leg Extension", reps: [12, 10, 10, 10] },
      { id: "rdl", name: "RDL", reps: [12, 10, 10, 8], search: "romanian deadlift" },
      { id: "calf-raise", name: "Calf", reps: [12, 12, 12, 12], search: "calf raise" },
      { id: "shoulder-press", name: "Shoulder Press", reps: [12, 12, 10, 10] },
      { id: "lateral-raise", name: "Lateral Raise", reps: [12, 10, 10, 10] },
      { id: "bent-over-fly", name: "Bent Over Fly", reps: [12, 12, 10, 10], search: "bent over reverse dumbbell fly" },
    ],
  },
  {
    id: "day4",
    name: "Day 4",
    focus: "Mixed / Full Upper",
    exercises: [
      { id: "long-bar-row", name: "Rowing Long Bar", reps: [12, 12, 12, 12], search: "t-bar row landmine" },
      { id: "face-pull", name: "Face Pull", reps: [12, 12, 12, 12] },
      { id: "bench-press", name: "Bench Press", reps: [12, 12, 12, 12] },
      { id: "high-low-cable-fly", name: "High to Low Chest Flys (Cable)", reps: [12, 12, 12, 12], search: "high to low cable chest fly" },
      { id: "barbell-curl-21s", name: "Barbell Curl (21s)", reps: [21, 21, 21, 21], note: "7 bottom half + 7 top half + 7 full", search: "barbell 21s curl" },
      { id: "reverse-barbell-curl", name: "Reverse Barbell Curl", reps: [12, 12, 12, 12] },
      { id: "tricep-day4", name: "Tricep", reps: [12, 12, 12, 12], search: "tricep exercises" },
    ],
  },
];
