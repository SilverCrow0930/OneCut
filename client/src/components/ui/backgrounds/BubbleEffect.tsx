import React, { useEffect, useRef } from 'react';
import '../../../styles/styles.scss';

const BubbleEffect = () => {

    // Interactable bubble
    const interBubbleRef = useRef<HTMLDivElement>(null);

    useEffect(() => {

        // Interactable bubble
        const interBubble = interBubbleRef.current;

        // If the interactable bubble is not found, return
        if (!interBubble) {
            return;
        }

        let curX = 0;
        let curY = 0;
        let tgX = 0;
        let tgY = 0;

        function move() {
            curX += (tgX - curX) / 20;
            curY += (tgY - curY) / 20;
            if (interBubble) {
                interBubble.style.transform = `translate(${Math.round(curX)}px, ${Math.round(curY)}px)`;
            }
            requestAnimationFrame(move);
        }

        const handleMouseMove = (event: MouseEvent) => {
            tgX = event.clientX;
            tgY = event.clientY;
        };

        window.addEventListener('mousemove', handleMouseMove);
        move();

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    return (
        <div className="bubble-effect-background">
            {/* <div className="text-container">
        Bubbles
      </div> */}
            <div className="gradient-bg">
                <svg xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <filter id="goo">
                            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
                            <feColorMatrix
                                in="blur"
                                mode="matrix"
                                values="1 0 0 0 0  
                        0 1 0 0 0  
                        0 0 1 0 0  
                        0 0 0 18 -8"
                                result="goo"
                            />
                            <feBlend in="SourceGraphic" in2="goo" />
                        </filter>
                    </defs>
                </svg>
                <div className="gradients-container">
                    <div className="g1"></div>
                    <div className="g2"></div>
                    <div className="g3"></div>
                    <div className="g4"></div>
                    <div className="g5"></div>
                    <div
                        ref={interBubbleRef}
                        className="interactive fixed top-0 left-0 w-10 h-10 bg-blue-500 rounded-full pointer-events-none"
                    ></div>
                </div>
            </div>
        </div>
    );
};

export default BubbleEffect;