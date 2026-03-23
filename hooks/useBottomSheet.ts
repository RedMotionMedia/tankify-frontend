import { useEffect, useRef, useState } from "react";

export function useBottomSheet() {
    const sheetContentRef = useRef<HTMLDivElement | null>(null);

    const [sheetY, setSheetY] = useState(0);
    const [dragging, setDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [startOffset, setStartOffset] = useState(0);

    useEffect(() => {
        setSheetY(window.innerHeight * 0.58);
    }, []);

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

        if (delta < 0 && sheetY > 0) {
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
        const snapTop = h * 0;
        const snapMid = h * 0.45;
        const snapBottom = h * 0.74;

        const options = [snapTop, snapMid, snapBottom];
        const nearest = options.reduce((prev, curr) =>
            Math.abs(curr - sheetY) < Math.abs(prev - sheetY) ? curr : prev
        );

        setSheetY(nearest);
    }

    function minimizeBottomSheet() {
        const h = window.innerHeight;
        setSheetY(h * 0.8);
    }

    return {
        sheetContentRef,
        sheetY,
        dragging,
        onTouchStart,
        onTouchMoveHandle,
        onTouchMoveContent,
        onTouchEnd,
        minimizeBottomSheet,
    };
}