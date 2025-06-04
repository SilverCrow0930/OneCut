/** Generate a default project name like "Untitled (1)", "Untitled (2)", etc. */
export function generateDefaultName(): string {
    // Simple timestamp-based approach for now to avoid async issues
    // TODO: Implement proper sequential numbering once server is stable
    const timestamp = Date.now().toString().slice(-4)
    return `Untitled (${timestamp})`
}