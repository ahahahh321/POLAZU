export type SupportedLanguage = "python" | "c" | "cpp" | "java" | "typescript" | "go";

export interface LanguageOption {
  id: SupportedLanguage;
  name: string;
  ext: string;
  badge: string;
  example: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { id: "python", name: "Python", ext: "py", badge: "PY", example: "print('Hello, POLAZU!')" },
  { id: "c", name: "C", ext: "c", badge: "C", example: 'printf("Hello, POLAZU!\\n");' },
  { id: "cpp", name: "C++", ext: "cpp", badge: "C++", example: 'std::cout << "Hello, POLAZU!" << std::endl;' },
  { id: "java", name: "Java", ext: "java", badge: "JAVA", example: 'System.out.println("Hello, POLAZU!");' },
  { id: "typescript", name: "TypeScript", ext: "ts", badge: "TS", example: 'console.log("Hello, POLAZU!");' },
  { id: "go", name: "Go", ext: "go", badge: "GO", example: 'fmt.Println("Hello, POLAZU!")' },
];

export const SAMPLE_CODES: Record<string, Record<SupportedLanguage, string>> = {
  hello: {
    python: `# 환영 메시지 출력
def greet(name):
    print("안녕하세요, " + name + "님!")
    print("POLAZU에 오신 것을 환영합니다.")

greet("Developer")
`,
    c: `#include <stdio.h>

// 환영 메시지 출력
void greet(const char* name) {
    printf("안녕하세요, %s님!\n", name);
    printf("POLAZU에 오신 것을 환영합니다.\n");
}

int main() {
    greet("Developer");
    return 0;
}
`,
    cpp: `#include <iostream>
#include <string>

// 환영 메시지 출력
void greet(const std::string& name) {
    std::cout << "안녕하세요, " << name << "님!" << std::endl;
    std::cout << "POLAZU에 오신 것을 환영합니다." << std::endl;
}

int main() {
    greet("Developer");
    return 0;
}
`,
    java: `// 환영 메시지 출력
public class Main {
    public static void greet(String name) {
        System.out.println("안녕하세요, " + name + "님!");
        System.out.println("POLAZU에 오신 것을 환영합니다.");
    }

    public static void main(String[] args) {
        greet("Developer");
    }
}
`,
    typescript: `// 환영 메시지 출력
function greet(name: string): void {
    console.log("안녕하세요, " + name + "님!");
    console.log("POLAZU에 오신 것을 환영합니다.");
}

greet("Developer");
`,
    go: `package main

import "fmt"

// 환영 메시지 출력
func greet(name string) {
    fmt.Println("안녕하세요, " + name + "님!")
    fmt.Println("POLAZU에 오신 것을 환영합니다.")
}

func main() {
    greet("Developer")
}
`,
  },

  fibonacci: {
    python: `# 피보나치 수열 계산 함수
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

def main():
    n = 10
    print("피보나치 결과:", fibonacci(n))

if __name__ == "__main__":
    main()
`,
    c: `#include <stdio.h>

// 피보나치 수열 계산 함수
int fibonacci(int n) {
    if (n <= 1) {
        return n;
    }
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    int n = 10;
    printf("피보나치 결과: %d\n", fibonacci(n));
    return 0;
}
`,
    cpp: `#include <iostream>

// 피보나치 수열 계산 함수
int fibonacci(int n) {
    if (n <= 1) {
        return n;
    }
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    int n = 10;
    std::cout << "피보나치 결과: " << fibonacci(n) << std::endl;
    return 0;
}
`,
    java: `// 피보나치 수열 계산 함수
public class Main {
    public static int fibonacci(int n) {
        if (n <= 1) {
            return n;
        }
        return fibonacci(n - 1) + fibonacci(n - 2);
    }

    public static void main(String[] args) {
        int n = 10;
        System.out.println("피보나치 결과: " + fibonacci(n));
    }
}
`,
    typescript: `// 피보나치 수열 계산 함수
function fibonacci(n: number): number {
    if (n <= 1) {
        return n;
    }
    return fibonacci(n - 1) + fibonacci(n - 2);
}

function main(): void {
    const n: number = 10;
    console.log("피보나치 결과:", fibonacci(n));
}

main();
`,
    go: `package main

import "fmt"

// 피보나치 수열 계산 함수
func fibonacci(n int) int {
    if n <= 1 {
        return n
    }
    return fibonacci(n - 1) + fibonacci(n - 2)
}

func main() {
    n := 10
    fmt.Println("피보나치 결과:", fibonacci(n))
}
`,
  },

  evenOdd: {
    python: `# 1부터 10까지 짝수와 홀수 판별
def check_even_odd(limit):
    for i in range(1, limit + 1):
        if i % 2 == 0:
            print(f"{i}: 짝수 (Even)")
        else:
            print(f"{i}: 홀수 (Odd)")

check_even_odd(10)
`,
    c: `#include <stdio.h>

// 1부터 10까지 짝수와 홀수 판별
void check_even_odd(int limit) {
    for (int i = 1; i <= limit; i++) {
        if (i % 2 == 0) {
            printf("%d: 짝수 (Even)\n", i);
        } else {
            printf("%d: 홀수 (Odd)\n", i);
        }
    }
}

int main() {
    check_even_odd(10);
    return 0;
}
`,
    cpp: `#include <iostream>

// 1부터 10까지 짝수와 홀수 판별
void check_even_odd(int limit) {
    for (int i = 1; i <= limit; i++) {
        if (i % 2 == 0) {
            std::cout << i << ": 짝수 (Even)" << std::endl;
        } else {
            std::cout << i << ": 홀수 (Odd)" << std::endl;
        }
    }
}

int main() {
    check_even_odd(10);
    return 0;
}
`,
    java: `// 1부터 10까지 짝수와 홀수 판별
public class Main {
    public static void checkEvenOdd(int limit) {
        for (int i = 1; i <= limit; i++) {
            if (i % 2 == 0) {
                System.out.println(i + ": 짝수 (Even)");
            } else {
                System.out.println(i + ": 홀수 (Odd)");
            }
        }
    }

    public static void main(String[] args) {
        checkEvenOdd(10);
    }
}
`,
    typescript: `// 1부터 10까지 짝수와 홀수 판별
function checkEvenOdd(limit: number): void {
    for (let i = 1; i <= limit; i++) {
        if (i % 2 === 0) {
            console.log(i + ": 짝수 (Even)");
        } else {
            console.log(i + ": 홀수 (Odd)");
        }
    }
}

checkEvenOdd(10);
`,
    go: `package main

import "fmt"

// 1부터 10까지 짝수와 홀수 판별
func checkEvenOdd(limit int) {
    for i := 1; i <= limit; i++ {
        if i % 2 == 0 {
            fmt.Printf("%d: 짝수 (Even)\n", i)
        } else {
            fmt.Printf("%d: 홀수 (Odd)\n", i)
        }
    }
}

func main() {
    checkEvenOdd(10)
}
`,
  }
};

/**
 * Intelligent rule-based code converter
 */
export function convertCode(
  source: string,
  from: SupportedLanguage,
  to: SupportedLanguage
): string {
  if (!source.trim()) return "";
  if (from === to) return source;

  // Check if it matches one of our known sample programs
  const trimmed = source.trim();
  for (const sampleKey of Object.keys(SAMPLE_CODES)) {
    const sample = SAMPLE_CODES[sampleKey];
    if (sample[from].trim() === trimmed) {
      return sample[to];
    }
  }

  // General heuristic transpilation
  const lines = source.split("\n");
  const translatedLines: string[] = [];

  for (let line of lines) {
    let converted = line;

    // 1. Comments
    if (from === "python" && (to === "c" || to === "cpp" || to === "java" || to === "typescript" || to === "go")) {
      converted = converted.replace(/^(\s*)#\s*(.*)$/, "$1// $2");
    } else if (to === "python" && from !== "python") {
      converted = converted.replace(/^(\s*)\/\/\s*(.*)$/, "$1# $2");
    }

    // 2. Booleans and Nulls
    if (to === "python") {
      converted = converted.replace(/\btrue\b/g, "True");
      converted = converted.replace(/\bfalse\b/g, "False");
      converted = converted.replace(/\bnull\b/g, "None");
      converted = converted.replace(/\bnil\b/g, "None");
      converted = converted.replace(/\bNULL\b/g, "None");
    } else {
      converted = converted.replace(/\bTrue\b/g, "true");
      converted = converted.replace(/\bFalse\b/g, "false");
      converted = converted.replace(/\bNone\b/g, to === "go" ? "nil" : to === "c" ? "NULL" : "null");
    }

    // 3. Print statements
    const printMatch = converted.match(/(\s*)(print|printf|System\.out\.println|std::cout|fmt\.Println|fmt\.Printf|console\.log)\s*\((.*)\);?/);
    if (printMatch) {
      const indent = printMatch[1];
      const args = printMatch[3];

      switch (to) {
        case "python":
          converted = `${indent}print(${args})`;
          break;
        case "c":
          converted = `${indent}printf("%s\\n", ${args});`;
          break;
        case "cpp":
          converted = `${indent}std::cout << ${args} << std::endl;`;
          break;
        case "java":
          converted = `${indent}System.out.println(${args});`;
          break;
        case "typescript":
          converted = `${indent}console.log(${args});`;
          break;
        case "go":
          converted = `${indent}fmt.Println(${args})`;
          break;
      }
    }

    // 4. Function definitions
    if (from === "python") {
      const funcMatch = converted.match(/^(\s*)def\s+([a-zA-Z0-9_]+)\s*\((.*?)\)\s*:/);
      if (funcMatch) {
        const indent = funcMatch[1];
        const funcName = funcMatch[2];
        const rawArgs = funcMatch[3];

        switch (to) {
          case "c":
            converted = `${indent}void ${funcName}(${rawArgs ? rawArgs : "void"}) {`;
            break;
          case "cpp":
            converted = `${indent}void ${funcName}(${rawArgs}) {`;
            break;
          case "java":
            converted = `${indent}public static void ${funcName}(${rawArgs}) {`;
            break;
          case "typescript":
            converted = `${indent}function ${funcName}(${rawArgs}): void {`;
            break;
          case "go":
            converted = `${indent}func ${funcName}(${rawArgs}) {`;
            break;
        }
      }

      if (converted.includes('if __name__ == "__main__":')) {
        continue;
      }
    }

    // 5. Conditionals & Loops
    if (from === "python" && to !== "python") {
      converted = converted.replace(/^(\s*)elif\s+(.*?)\s*:/, "$1} else if ($2) {");
      converted = converted.replace(/^(\s*)if\s+(.*?)\s*:/, "$1if ($2) {");
      converted = converted.replace(/^(\s*)else\s*:/, "$1} else {");

      const rangeMatch = converted.match(/^(\s*)for\s+([a-zA-Z0-9_]+)\s+in\s+range\((.*?)\)\s*:/);
      if (rangeMatch) {
        const indent = rangeMatch[1];
        const varName = rangeMatch[2];
        const rangeArg = rangeMatch[3];
        if (to === "go") {
          converted = `${indent}for ${varName} := 0; ${varName} < ${rangeArg}; ${varName}++ {`;
        } else if (to === "typescript") {
          converted = `${indent}for (let ${varName} = 0; ${varName} < ${rangeArg}; ${varName}++) {`;
        } else {
          converted = `${indent}for (int ${varName} = 0; ${varName} < ${rangeArg}; ${varName}++) {`;
        }
      }
    } else if (to === "python" && from !== "python") {
      if (converted.trim() === "}" || converted.trim() === "};") {
        continue;
      }
      converted = converted.replace(/\s*;\s*$/, "");
      converted = converted.replace(/^(\s*)else\s+if\s*\((.*?)\)\s*\{?/, "$1elif $2:");
      converted = converted.replace(/^(\s*)if\s*\((.*?)\)\s*\{?/, "$1if $2:");
      converted = converted.replace(/^(\s*)else\s*\{?/, "$1else:");
      converted = converted.replace(/^(\s*)function\s+([a-zA-Z0-9_]+)\s*\((.*?)\).*\{?/, "$1def $2($3):");
      converted = converted.replace(/^(\s*)(?:public|private|static|void|int|double|bool|float|\s)+\s+([a-zA-Z0-9_]+)\s*\((.*?)\)\s*\{?/, "$1def $2($3):");
      converted = converted.replace(/^(\s*)func\s+([a-zA-Z0-9_]+)\s*\((.*?)\).*\{?/, "$1def $2($3):");
    }

    // 6. Semicolons
    if (to === "python" || to === "go") {
      converted = converted.replace(/;\s*$/, "");
    } else if ((to === "c" || to === "cpp" || to === "java" || to === "typescript") && from === "python") {
      const trimmed = converted.trim();
      if (
        trimmed &&
        !trimmed.endsWith("{") &&
        !trimmed.endsWith("}") &&
        !trimmed.startsWith("//") &&
        !trimmed.startsWith("#") &&
        !trimmed.endsWith(";")
      ) {
        converted += ";";
      }
    }

    translatedLines.push(converted);
  }

  let result = translatedLines.join("\n").trim();

  // 7. Language Boilerplate Wrappers
  if (to === "c") {
    const hasInclude = result.includes("#include");
    const prefix = hasInclude ? "" : "#include <stdio.h>\n#include <stdbool.h>\n\n";
    if (!result.includes("int main") && !result.includes("void main")) {
      result = `${prefix}${result}\n\nint main() {\n    // 실행 시작\n    return 0;\n}`;
    } else {
      result = `${prefix}${result}`;
    }
  } else if (to === "cpp") {
    const hasInclude = result.includes("#include");
    const prefix = hasInclude ? "" : "#include <iostream>\n#include <vector>\n#include <string>\n\n";
    if (!result.includes("int main") && !result.includes("void main")) {
      result = `${prefix}${result}\n\nint main() {\n    // 실행 시작\n    return 0;\n}`;
    } else {
      result = `${prefix}${result}`;
    }
  } else if (to === "java") {
    if (!result.includes("class ")) {
      const indentedBody = result
        .split("\n")
        .map((l) => (l ? "    " + l : l))
        .join("\n");
      result = `public class Main {\n${indentedBody}\n\n    public static void main(String[] args) {\n        // 메인 실행 루틴\n    }\n}`;
    }
  } else if (to === "go") {
    const prefix = `package main\n\nimport (\n    "fmt"\n)\n\n`;
    if (!result.includes("package main")) {
      if (!result.includes("func main")) {
        result = `${prefix}${result}\n\nfunc main() {\n    // 메인 실행 루틴\n}`;
      } else {
        result = `${prefix}${result}`;
      }
    }
  }

  return result;
}
