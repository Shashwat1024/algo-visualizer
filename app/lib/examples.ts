/** Starter snippets loaded into the editor. The tracer does not depend on
 *  these — any pasted code works. A sorting function on its own is called
 *  automatically with a random array; anything else (graphs, trees) should
 *  build its own input and call itself, as the examples below do. */
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
  {
    value: "bfs",
    label: "BFS (graph)",
    code: `from collections import deque

graph = {
    "A": ["B", "C"],
    "B": ["D", "E"],
    "C": ["F"],
    "D": [],
    "E": ["F"],
    "F": ["G"],
    "G": [],
}

def bfs(graph, start):
    visited = set()
    queue = deque([start])
    order = []
    while queue:
        node = queue.popleft()
        if node in visited:
            continue
        visited.add(node)
        order.append(node)
        for neighbour in graph[node]:
            queue.append(neighbour)
    return order

bfs(graph, "A")
`,
  },
  {
    value: "dfs",
    label: "DFS (graph)",
    code: `graph = {
    "A": ["B", "C"],
    "B": ["D", "E"],
    "C": ["F"],
    "D": [],
    "E": ["F"],
    "F": ["G"],
    "G": [],
}

def dfs(graph, start):
    visited = set()
    stack = [start]
    order = []
    while stack:
        node = stack.pop()
        if node in visited:
            continue
        visited.add(node)
        order.append(node)
        for neighbour in reversed(graph[node]):
            stack.append(neighbour)
    return order

dfs(graph, "A")
`,
  },
  {
    value: "inorder",
    label: "Tree traversal",
    code: `class Node:
    def __init__(self, val, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

root = Node(8,
    Node(3, Node(1), Node(6, Node(4), Node(7))),
    Node(10, None, Node(14, Node(13))))

def inorder(node, out=None):
    if out is None:
        out = []
    if node is None:
        return out
    inorder(node.left, out)
    out.append(node.val)
    inorder(node.right, out)
    return out

inorder(root)
`,
  },
];
