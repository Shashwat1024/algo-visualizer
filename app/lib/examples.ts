/** Starter snippets loaded into the editor. The tracer does not depend on
 *  these — any pasted function that sorts a list of numbers works. */
export const EXAMPLES: { value: string; label: string; code: string }[] = [
  {
    value: "bubble",
    label: "Bubble Sort",
    code: `def bubble_sort(values):
    n = len(values)
    for i in range(n - 1):
        for j in range(n - i - 1):
            if values[j] > values[j + 1]:
                values[j], values[j + 1] = values[j + 1], values[j]
    return values
`,
  },
  {
    value: "insertion",
    label: "Insertion Sort",
    code: `def insertion_sort(values):
    for i in range(1, len(values)):
        key = values[i]
        j = i - 1
        while j >= 0 and values[j] > key:
            values[j + 1] = values[j]
            j -= 1
        values[j + 1] = key
    return values
`,
  },
  {
    value: "selection",
    label: "Selection Sort",
    code: `def selection_sort(values):
    n = len(values)
    for i in range(n):
        lowest = i
        for j in range(i + 1, n):
            if values[j] < values[lowest]:
                lowest = j
        values[i], values[lowest] = values[lowest], values[i]
    return values
`,
  },
  {
    value: "quick",
    label: "Quick Sort",
    code: `def quick_sort(values, lo=0, hi=None):
    if hi is None:
        hi = len(values) - 1
    if lo >= hi:
        return values
    pivot = values[hi]
    i = lo - 1
    for j in range(lo, hi):
        if values[j] <= pivot:
            i += 1
            values[i], values[j] = values[j], values[i]
    values[i + 1], values[hi] = values[hi], values[i + 1]
    pivot_index = i + 1
    quick_sort(values, lo, pivot_index - 1)
    quick_sort(values, pivot_index + 1, hi)
    return values
`,
  },
  {
    value: "merge",
    label: "Merge Sort (in place)",
    code: `def merge_sort(values, lo=0, hi=None):
    if hi is None:
        hi = len(values) - 1
    if lo >= hi:
        return values
    mid = (lo + hi) // 2
    merge_sort(values, lo, mid)
    merge_sort(values, mid + 1, hi)
    _merge(values, lo, mid, hi)
    return values

def _merge(values, lo, mid, hi):
    left = values[lo:mid + 1]
    right = values[mid + 1:hi + 1]
    i = j = 0
    k = lo
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            values[k] = left[i]
            i += 1
        else:
            values[k] = right[j]
            j += 1
        k += 1
    while i < len(left):
        values[k] = left[i]
        i += 1
        k += 1
    while j < len(right):
        values[k] = right[j]
        j += 1
        k += 1
`,
  },
];
