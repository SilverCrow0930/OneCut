/** YYYYMMDDHHMM, e.g. "202505021141" */
export function generateDefaultName(): string {
    const now = new Date()
    const yyyy = now.getFullYear()
    const MM = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    return `${yyyy}${MM}${dd}${hh}${mm}`
}