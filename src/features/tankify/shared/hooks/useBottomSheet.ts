import { useEffect, useRef, useState } from "react";

export function useBottomSheet() {
    const sheetContentRef = useRef<HTMLDivElement | null>(null);

    const snapTopMultiplicator = 0;
    const snapMidMultiplicator = 0.4;
    const snapWorthMultiplicator = 0.17;
    const snapBottomMultiplicator = 0.82;

    // Start at the same "resting" position immediately to avoid a visible jump on reload.
    const initialSheetY = (() => {
        if (typeof window === "undefined") return 0;
        const h = window.visualViewport?.height ?? window.innerHeight;
        return h * snapBottomMultiplicator;
    })();

    const [sheetY, setSheetY] = useState(initialSheetY);
    const [dragging, setDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [startOffset, setStartOffset] = useState(0);
    const [isSheetReady, setIsSheetReady] = useState(false);

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            // If we rendered from SSR fallback (0), sync once on mount.
            if (sheetY === 0) {
                const h = window.visualViewport?.height ?? window.innerHeight;
                setSheetY(h * snapBottomMultiplicator);
            }
            setIsSheetReady(true);
        });

        return () => window.cancelAnimationFrame(frame);
    }, [sheetY]);

    function onTouchStart(e: React.TouchEvent) {
        setDragging(true);
        setStartY(e.touches[0].clientY);
        setStartOffset(sheetY);
    }

    function onTouchMoveHandle(e: React.TouchEvent) {
        if (!dragging) return;

        const currentY = e.touches[0].clientY;
        const delta = currentY - startY;
        const content = sheetContentRef.current;

        const atTop = !content || content.scrollTop <= 0;


        if (delta > 0 && atTop) {
            setSheetY(Math.max(0, startOffset + delta));
            return;
        }

        if (delta < 0) {
            setSheetY(Math.max(0, startOffset + delta));
        }
    }

    function onTouchMoveContent(e: React.TouchEvent) {
        if (!dragging) return;

        const currentY = e.touches[0].clientY;
        const delta = currentY - startY;
        const content = sheetContentRef.current;

        const atTop = !content || content.scrollTop <= 0;
        const atEnd =
            !content || content.scrollTop + window.innerHeight >= content.scrollHeight;

        if (delta > 0 && atTop) {
            setSheetY(Math.max(0, startOffset + delta));
            return;
        }

        if (delta < 0 && sheetY > 0 && atEnd) {
            setSheetY(Math.max(0, startOffset + delta));
        }
    }

    function onTouchEnd() {
        setDragging(false);

        const h = window.innerHeight;
        const snapTop = h * snapTopMultiplicator;
        const snapMid = h * snapMidMultiplicator;
        const snapBottom = h * snapBottomMultiplicator;

        const options = [snapTop, snapMid, snapBottom];
        const nearest = options.reduce((prev, curr) =>
            Math.abs(curr - sheetY) < Math.abs(prev - sheetY) ? curr : prev
        );

        setSheetY(nearest);
    }

    function minimizeBottomSheet() {
        const h = window.innerHeight;

        sheetContentRef.current?.scrollTo({
            top: 0,
            behavior: "smooth",
        });

        setSheetY(h * snapBottomMultiplicator);
    }

    function setBottomSheet(snapHeight: number) {
        setSheetY(snapHeight);
    }

    return {
        sheetContentRef,
        sheetY,
        dragging,
        isSheetReady,
        snapWorthMultiplicator,
        onTouchStart,
        onTouchMoveHandle,
        onTouchMoveContent,
        onTouchEnd,
        minimizeBottomSheet,
        setBottomSheet,
    };
}
