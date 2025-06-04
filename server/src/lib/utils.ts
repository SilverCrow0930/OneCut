import { supabase } from '../config/supabaseClient.js'

/** Generate a default project name like "Untitled (1)", "Untitled (2)", etc. */
export async function generateDefaultName(userId: string): Promise<string> {
    try {
        // Find all existing projects for this user that start with "Untitled"
        const { data: existingProjects, error } = await supabase
            .from('projects')
            .select('name')
            .eq('user_id', userId)
            .like('name', 'Untitled%')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching existing projects:', error)
            // Fallback to timestamp if there's an error
            const timestamp = Date.now().toString().slice(-4)
            return `Untitled (${timestamp})`
        }

        // Extract numbers from existing "Untitled (X)" projects
        const existingNumbers = new Set<number>()
        
        if (existingProjects) {
            existingProjects.forEach(project => {
                const match = project.name.match(/^Untitled \((\d+)\)$/)
                if (match) {
                    existingNumbers.add(parseInt(match[1], 10))
                }
            })
        }

        // Find the next available number
        let nextNumber = 1
        while (existingNumbers.has(nextNumber)) {
            nextNumber++
        }

        return `Untitled (${nextNumber})`
    } catch (error) {
        console.error('Error in generateDefaultName:', error)
        // Fallback to timestamp if there's an error
        const timestamp = Date.now().toString().slice(-4)
        return `Untitled (${timestamp})`
    }
}