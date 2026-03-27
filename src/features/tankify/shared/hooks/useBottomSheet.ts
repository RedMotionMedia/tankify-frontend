import { useEffect, useRef, useState } from "react";

export function useBottomSheet() {
    const sheetContentRef = useRef<HTMLDivElement | null>(null);

    const snapTopMultiplicator = 0;
    const snapMidMultiplicator = 0.4;
    const snapWorthMultiplicator = 0.17;
    const snapBottomMultiplicator = 0.82;

    function getViewportHeight() {
        return window.visualViewport?.height ?? window.innerHeight;
    }

    const initialSheetY = (() => {
        if (typeof window === "undefined") return 0;
        const h = getViewportHeight();
        return h * snapBottomMultiplicator;
    })();

    const [sheetY, setSheetY] = useState(initialSheetY);
    const [dragging, setDragging] = useState(false);
    const [isSheetReady, setIsSheetReady] = useState(false);

    const draggingRef = useRef(false);
    const dragSourceRef = useRef<"handle" | "content" | null>(null);
    const pendingContentDragRef = useRef(false);
    const startXRef = useRef(0);
    const startYRef = useRef(0);
    const startOffsetRef = useRef(0);
    const axisRef = useRef<"undecided" | "horizontal" | "vertical">("undecided");

    const dragRafRef = useRef<number | null>(null);
    const pendingSheetYRef = useRef<number | null>(null);

    function cancelDragRaf() {
        if (dragRafRef.current != null) {
            window.cancelAnimationFrame(dragRafRef.current);
            dragRafRef.current = null;
        }
    }

    function commitSheetY(nextY: number) {
        const epsilon = 2;
        const v = nextY <= epsilon ? 0 : nextY;
        setSheetY(v);
    }

    function setSheetYThrottled(nextY: number) {
        const epsilon = 2;
        const v = nextY <= epsilon ? 0 : nextY;

        if (v === 0) {
            pendingSheetYRef.current = null;
            cancelDragRaf();
            setSheetY(0);
            return;
        }

        pendingSheetYRef.current = v;
        if (dragRafRef.current != null) return;

        dragRafRef.current = window.requestAnimationFrame(() => {
            dragRafRef.current = null;
            const pending = pendingSheetYRef.current;
            pendingSheetYRef.current = null;
            if (pending == null) return;
            setSheetY(pending);
        });
    }

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            setIsSheetReady(true);
        });
        return () => window.cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        return () => {
            cancelDragRaf();
        };
    }, []);

    function captureStart(e: React.TouchEvent, source: "handle" | "content") {
        draggingRef.current = true;
        setDragging(true);
        dragSourceRef.current = source;
        axisRef.current = "undecided";
        pendingContentDragRef.current = false;

        const t = e.touches[0];
        startXRef.current = t.clientX;
        startYRef.current = t.clientY;
        startOffsetRef.current = sheetY;
    }

    function onTouchStartHandle(e: React.TouchEvent) {
        captureStart(e, "handle");
    }

    function onTouchStartContent(e: React.TouchEvent) {
        const target = e.target as HTMLElement | null;
        if (target?.closest("input, textarea, select, button, a[href], [data-no-sheet-drag]")) {
            return;
        }

        const content = sheetContentRef.current;
        const atTop = !content || content.scrollTop <= 0;

        // If we're fully expanded and the user is scrolling inside the sheet,
        // don't hijack the gesture as a sheet drag.
        if (sheetY === 0 && !atTop) return;

        // For content drags we defer "starting a sheet drag" until we know the gesture is vertical.
        // This keeps horizontal carousel swipes responsive on the calculator page.
        draggingRef.current = false;
        setDragging(false);
        dragSourceRef.current = "content";
        pendingContentDragRef.current = true;
        axisRef.current = "undecided";

        const t = e.touches[0];
        startXRef.current = t.clientX;
        startYRef.current = t.clientY;
        startOffsetRef.current = sheetY;
    }

    function decideAxis(dx: number, dy: number): "undecided" | "horizontal" | "vertical" {
        const threshold = 6;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);

        if (axisRef.current === "undecided") {
            if (adx < threshold && ady < threshold) return "undecided"; // not enough signal yet
            axisRef.current = adx > ady ? "horizontal" : "vertical";
        }

        return axisRef.current;
    }

    function onTouchMove(e: React.TouchEvent) {
        if (dragSourceRef.current == null) return;

        const t = e.touches[0];
        const dx = t.clientX - startXRef.current;
        const dy = t.clientY - startYRef.current;
        const axis = decideAxis(dx, dy);
        if (axis === "undecided") return;
        if (axis === "horizontal") {
            // Horizontal swipe should belong to the carousel/list, not the sheet.
            draggingRef.current = false;
            pendingContentDragRef.current = false;
            dragSourceRef.current = null;
            setDragging(false);
            axisRef.current = "undecided";
            return;
        }

        if (dragSourceRef.current === "handle") {
            if (!draggingRef.current) return;
            setSheetYThrottled(Math.max(0, startOffsetRef.current + dy));
            return;
        }

        const content = sheetContentRef.current;
        const atTop = !content || content.scrollTop <= 0;
        const atBottom = Boolean(
            content &&
            content.scrollTop + content.clientHeight >= content.scrollHeight - 2
        );
        const canScrollDown = Boolean(
            content && content.scrollHeight - content.clientHeight > 2
        );
        const canScrollMoreDown = Boolean(
            content &&
            content.scrollHeight - content.clientHeight > 2 &&
            content.scrollTop + content.clientHeight < content.scrollHeight - 2
        );

        // If this is a content gesture and we haven't actually started a sheet drag yet,
        // decide whether this should become a sheet drag at all.
        if (!draggingRef.current && pendingContentDragRef.current) {
            const shouldStartDrag =
                (
                    // Pulling down at the top should collapse the sheet.
                    (dy > 0 && atTop) ||
                    // Pulling up should expand the sheet when the content cannot scroll further down
                    // (either because there is no scroll or we're already at the bottom).
                    (dy < 0 && sheetY > 0 && (!canScrollDown || !canScrollMoreDown))
                );

            if (!shouldStartDrag) {
                // Let the content scroll naturally. Don't turn this gesture into a sheet drag mid-stream.
                pendingContentDragRef.current = false;
                dragSourceRef.current = null;
                axisRef.current = "undecided";
                return;
            }

            draggingRef.current = true;
            pendingContentDragRef.current = false;
            setDragging(true);
        }

        // Drag down to collapse when the content is at the top.
        if (dy > 0 && atTop) {
            setSheetYThrottled(Math.max(0, startOffsetRef.current + dy));
            return;
        }

        // Drag up to expand while we're not fully expanded yet and the content cannot scroll further down.
        if (dy < 0 && sheetY > 0 && (!canScrollDown || atBottom)) {
            setSheetYThrottled(Math.max(0, startOffsetRef.current + dy));
        }
    }

    function onTouchEnd() {
        if (!draggingRef.current) {
            pendingContentDragRef.current = false;
            dragSourceRef.current = null;
            axisRef.current = "undecided";
            return;
        }
        draggingRef.current = false;
        setDragging(false);
        dragSourceRef.current = null;
        pendingContentDragRef.current = false;
        axisRef.current = "undecided";

        const h = getViewportHeight();
        const snapTop = h * snapTopMultiplicator;
        const snapMid = h * snapMidMultiplicator;
        const snapBottom = h * snapBottomMultiplicator;

        const effectiveY = pendingSheetYRef.current ?? sheetY;
        pendingSheetYRef.current = null;
        cancelDragRaf();

        // Make snapping to top easier.
        const topCutoff = h * 0.38;
        const midCutoff = h * 0.72;

        if (effectiveY <= topCutoff) {
            commitSheetY(snapTop);
            return;
        }
        if (effectiveY <= midCutoff) {
            commitSheetY(snapMid);
            return;
        }
        commitSheetY(snapBottom);
    }

    function minimizeBottomSheet() {
        const h = getViewportHeight();

        sheetContentRef.current?.scrollTo({
            top: 0,
            behavior: "smooth",
        });

        commitSheetY(h * snapBottomMultiplicator);
    }

    function setBottomSheet(snapHeight: number) {
        pendingSheetYRef.current = null;
        cancelDragRaf();
        commitSheetY(snapHeight);
    }

    return {
        sheetContentRef,
        sheetY,
        dragging,
        isSheetReady,
        snapMidMultiplicator,
        snapWorthMultiplicator,
        onTouchStartHandle,
        onTouchStartContent,
        onTouchMoveHandle: onTouchMove,
        onTouchMoveContent: onTouchMove,
        onTouchEnd,
        minimizeBottomSheet,
        setBottomSheet,
    };
}
