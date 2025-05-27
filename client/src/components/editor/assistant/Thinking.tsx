import { useState, useEffect } from "react";

interface ThinkingDotsProps {
    text?: string;
    dotCount?: number;
    animationSpeed?: number;
}

export default function ThinkingDots({
    text = "Thinking",
    dotCount = 3,
    animationSpeed = 500
}: ThinkingDotsProps) {
    const [activeDots, setActiveDots] = useState<number>(1);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveDots((prev) => (prev % dotCount) + 1);
        }, animationSpeed);

        return () => clearInterval(interval);
    }, [dotCount, animationSpeed]);

    return (
        <div className="flex items-center p-2 bg-transparent">
            <span className="text-sm font-normal text-gray-700">{text}</span>
            <div className="flex ml-1 space-x-1">
                {Array.from({ length: dotCount }, (_, i) => i + 1).map((dot) => (
                    <span
                        key={dot}
                        className={`
              inline-block w-1 h-1 bg-gray-500 rounded-full
              transition-transform duration-300 ease-in-out
              ${dot <= activeDots ? "transform translate-y-0" : "transform translate-y-1 opacity-50"}
            `}
                    />
                ))}
            </div>
        </div>
    );
}