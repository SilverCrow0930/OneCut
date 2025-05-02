import React from 'react';
import { useRouter } from 'next/navigation';

const LemonaLogo = () => {
    const router = useRouter()

    return (
        <button
            onClick={() => router.push('/')}
        >
            <img
                src="/assets/main/lemona-logo.png"
                alt="Lemona Logo"
                className={`w-36`}
            />
        </button>
    )
}

export default LemonaLogo