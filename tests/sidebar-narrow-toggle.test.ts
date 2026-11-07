import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	INITIAL_SIDEBAR_STATE,
	sidebarReducer,
	sidebarVisible,
	type SidebarAction,
	type SidebarState,
} from "../components/sidebar.tsx";

/**
 * #271: below 928px the shell may be unable to widen (tiled/snapped/
 * maximized windows), so toggling must still show the sidebar, and must
 * decide from what is visible, not from the stored preference.
 */
const run = (actions: SidebarAction[], from: Partial<SidebarState> = {}) =>
	actions.reduce(sidebarReducer, { ...INITIAL_SIDEBAR_STATE, ...from });
const narrow: SidebarAction = { type: "resize", narrow: true };
const wide: SidebarAction = { type: "resize", narrow: false };
const settled: SidebarAction = { type: "settled" };
const toggle: SidebarAction = { type: "toggle" };

describe("sidebar reducer at narrow widths", () => {
	it("narrow, toggle: visible and asks to widen, even if the window stays narrow", () => {
		const s = run([{ type: "restore", open: false }, narrow, toggle]);
		assert.equal(s.widen, true);
		assert.equal(s.persist, "0"); // unchanged from before #271; see PR notes
		assert.equal(sidebarVisible(s), true);
		assert.equal(sidebarVisible(run([narrow], s)), true); // resize while still narrow
	});

	it("stored open + narrow: one toggle shows it and asks to widen", () => {
		const s = run([{ type: "restore", open: true }, narrow]);
		assert.equal(sidebarVisible(s), false);
		const next = run([toggle], s);
		assert.equal(sidebarVisible(next), true);
		assert.equal(next.widen, true);
	});

	it("a WM that flashes the wide size then snaps back keeps it visible (real openbox trace)", () => {
		const s = run([{ type: "restore", open: false }, narrow, toggle, wide, narrow]);
		assert.equal(sidebarVisible(s), true);
	});

	it("forced open, window stays wide: visible, force cleared; narrowing again auto-closes", () => {
		const s = run([{ type: "restore", open: false }, narrow, toggle, wide, settled]);
		assert.equal(sidebarVisible(s), true);
		assert.equal(s.forced, false);
		assert.equal(sidebarVisible(run([narrow], s)), false);
		assert.equal(run([narrow], s).open, true); // preference untouched
	});

	it("settled while still narrow keeps the force", () => {
		assert.equal(sidebarVisible(run([{ type: "restore", open: false }, narrow, toggle, settled])), true);
	});

	it("narrow, toggle twice: hidden and not forced", () => {
		const s = run([{ type: "restore", open: false }, narrow, toggle, toggle]);
		assert.equal(sidebarVisible(s), false);
		assert.equal(s.forced, false);
		assert.equal(s.persist, "0");
		assert.equal(s.widen, false);
	});

	it("resizing alone auto-closes and restores without persisting or widening", () => {
		const s = run([{ type: "restore", open: true }, narrow]);
		assert.deepEqual([sidebarVisible(s), s.persist, s.widen], [false, null, false]);
		assert.equal(sidebarVisible(run([wide], s)), true);
	});

	it("wide windows toggle as before, persist 1/0 and never widen", () => {
		const opened = run([{ type: "restore", open: false }, wide, toggle]);
		assert.deepEqual([sidebarVisible(opened), opened.persist, opened.widen], [true, "1", false]);
		const closed = run([toggle], opened);
		assert.deepEqual([sidebarVisible(closed), closed.persist, closed.widen], [false, "0", false]);
	});

	it("a no-op resize returns the same state object (no re-render per drag event)", () => {
		const s = run([{ type: "restore", open: true }, narrow]);
		assert.equal(sidebarReducer(s, narrow), s);
		assert.equal(sidebarReducer(s, settled), s);
	});
});
