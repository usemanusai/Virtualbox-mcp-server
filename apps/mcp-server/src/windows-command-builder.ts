export interface NormalizedPathResult {
    original: string;
    normalized: string;
    changed: boolean;
    warnings: string[];
}

export interface WindowsBuildResult {
    commandLine: string;
    argvTrace: string[];
    pathNormalizationApplied: boolean;
    warnings: string[];
}

export function normalizeWindowsPath(input: string): NormalizedPathResult {
    const original = input ?? "";
    let normalized = original;
    const warnings: string[] = [];

    if (normalized.includes("/")) {
        normalized = normalized.replace(/\//g, "\\");
    }

    // Preserve UNC prefix while normalizing duplicate slashes in the remainder.
    if (normalized.startsWith("\\\\")) {
        const uncBody = normalized.slice(2).replace(/\\{2,}/g, "\\");
        normalized = `\\\\${uncBody}`;
    } else {
        normalized = normalized.replace(/\\{2,}/g, "\\");
    }

    if (/^[A-Za-z]:$/.test(normalized)) {
        warnings.push("Drive-relative path provided; command behavior depends on current directory for that drive.");
    }

    if (normalized.startsWith("\\\\") && normalized.length < 5) {
        warnings.push("UNC path looks incomplete.");
    }

    return {
        original,
        normalized,
        changed: normalized !== original,
        warnings
    };
}

export function quoteWindowsArg(input: string): string {
    const value = input ?? "";
    const needsQuotes = value.length === 0 || /[\s"&|<>^()%!]/.test(value) || value.endsWith("\\");
    if (!needsQuotes) return value;

    // Escape inner quotes and preserve trailing backslashes before final quote.
    const escaped = value.replace(/"/g, '\\"').replace(/(\\+)$/g, "$1$1");
    return `"${escaped}"`;
}

export function buildWindowsCommandLine(program: string, args: string[], workingDir?: string): WindowsBuildResult {
    const warnings: string[] = [];
    const argvTrace: string[] = [];
    const normArgs = args.map(a => {
        const n = normalizeWindowsPath(a);
        warnings.push(...n.warnings);
        return n;
    });

    const normProgram = normalizeWindowsPath(program);
    warnings.push(...normProgram.warnings);

    let pathNormalizationApplied = normProgram.changed || normArgs.some(a => a.changed);
    let commandLine = `${quoteWindowsArg(normProgram.normalized)} ${normArgs.map(a => quoteWindowsArg(a.normalized)).join(" ")}`.trim();

    argvTrace.push(normProgram.normalized, ...normArgs.map(a => a.normalized));

    if (workingDir) {
        const wd = normalizeWindowsPath(workingDir);
        warnings.push(...wd.warnings);
        pathNormalizationApplied = pathNormalizationApplied || wd.changed;
        commandLine = `cd /d ${quoteWindowsArg(wd.normalized)} && ${commandLine}`;
        argvTrace.unshift("cmd.exe", "/d", "/s", "/c", `cd /d ${wd.normalized}`);
    }

    return {
        commandLine,
        argvTrace,
        pathNormalizationApplied,
        warnings: Array.from(new Set(warnings)).sort()
    };
}

