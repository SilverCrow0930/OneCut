import { supabase } from '../config/supabaseClient.js'

/** Generate a default project name like "Untitled Project 1", "Untitled Project 2", etc. */
export async function generateDefaultName(userId: string): Promise<string> {
    try {
        // Get all projects for this user that start with "Untitled Project"
        const { data: existingProjects, error } = await supabase
            .from('projects')
            .select('name')
            .eq('user_id', userId)
            .like('name', 'Untitled Project%')
            .order('name')

        if (error) {
            console.error('Error fetching existing projects:', error)
            // Fallback to timestamp-based naming
            const timestamp = Date.now().toString().slice(-4)
            return `Untitled Project (${timestamp})`
        }

        // Extract numbers from existing project names
        const numbers = existingProjects?.map(project => {
            const match = project.name.match(/^Untitled Project (\d+)$/)
            return match ? parseInt(match[1]) : 0
        }).filter(num => num > 0).sort((a, b) => a - b) || []

        // Find the next available number
        let nextNumber = 1
        for (const num of numbers) {
            if (num === nextNumber) {
                nextNumber++
            } else {
                break
            }
        }

        return `Untitled Project ${nextNumber}`
    } catch (error) {
        console.error('Error generating default name:', error)
        // Fallback to timestamp-based naming
        const timestamp = Date.now().toString().slice(-4)
        return `Untitled Project (${timestamp})`
    }
}