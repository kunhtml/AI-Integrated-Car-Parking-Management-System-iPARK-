import importlib.util

spec = importlib.util.spec_from_file_location("gen", r"D:\sep490\docs\generate_uc_word.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
cases = m.USE_CASES


def classify(n: int) -> str:
    if n <= 3:
        return "Simple"
    if n <= 7:
        return "Medium"
    return "Complex"


rows = []
for uc in cases:
    main = len(uc["basic_flow"])
    alt = len(uc["alternative_flows"])
    exc = len(uc["exception_flows"])
    total = main + alt + exc
    rows.append((uc["id"], uc["name"], main, alt, exc, total, classify(main)))

medium = [r for r in rows if r[6] == "Medium"]
simple = [r for r in rows if r[6] == "Simple"]
complex_ = [r for r in rows if r[6] == "Complex"]

print("TONG_UC", len(rows))
print("SIMPLE", len(simple))
print("MEDIUM", len(medium))
print("COMPLEX", len(complex_))
print("---")
for r in rows:
    print(f"{r[0]}\t{r[2]}\t{r[3]}\t{r[4]}\t{r[5]}\t{r[6]}")
