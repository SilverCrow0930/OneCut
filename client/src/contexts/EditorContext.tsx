'use client';

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Project } from '@/types/projects';
import { apiPath } from '@/lib/config';
import { useParams } from 'next/navigation';

interface ProjectContextType {
    project: Project | null;
    loading: boolean;
    error: string | null;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

interface ProjectProviderProps {
    children: ReactNode;
}

export const ProjectProvider = ({ children }: ProjectProviderProps) => {
    const { projectId } = useParams();
    const { session } = useAuth();

    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!session?.access_token || !projectId) return;

        let cancelled = false;
        setLoading(true);
        setError(null);

        (async () => {
            try {
                const response = await fetch(apiPath(`projects/${projectId}`), {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`
                    },
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Error ${response.status}: ${errorText}`);
                }
                const data: Project = await response.json();
                if (!cancelled) {
                    setProject(data);
                }
            }
            catch (err: any) {
                if (!cancelled) {
                    setError(err.message);
                }
            }
            finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [session, projectId]);

    return (
        <ProjectContext.Provider value={{ project, loading, error }}>
            {children}
        </ProjectContext.Provider>
    );
};

export function useProject() {
    const context = useContext(ProjectContext);
    if (!context) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context;
}
