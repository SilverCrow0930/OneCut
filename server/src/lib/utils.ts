/** Generate a default project name like "Untitled Project (1)", "Untitled Project (2)", etc. */
export function generateDefaultName(): string {
    const now = new Date()
    const timestamp = now.getTime().toString().slice(-4) // Last 4 digits of timestamp for uniqueness
    return `Untitled Project (${timestamp})`
}