// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

function setupTheme() {
	var root = document.documentElement;
	var buttons = document.querySelectorAll(".theme-switch [data-theme-choice]");
	var liveThemeButtons = document.querySelectorAll(".live-theme-switch [data-theme-choice]");
	const LIVE_THEME_KEY = "tournament-generator:live-theme";

	const getSaved = () => {
		try {
			const savedTheme = localStorage.getItem("theme");
			return savedTheme === "light" || savedTheme === "dark" ? savedTheme : "auto";
		} catch {
			return "auto";
		}
	};

	const apply = (choice) => {
		if (choice === "auto") root.removeAttribute("data-theme");
		else root.dataset.theme = choice;

		try {
			if (choice === "auto") localStorage.removeItem("theme");
			else localStorage.setItem("theme", choice);
		} catch {}

		buttons.forEach((b) => {
			b.setAttribute("aria-pressed", String(b.dataset.themeChoice === choice));
		});
	};

	const getSavedLiveTheme = () => {
		try {
			const savedTheme = localStorage.getItem(LIVE_THEME_KEY);
			return savedTheme === "light" || savedTheme === "dark" ? savedTheme : "inherit";
		} catch {
			return "inherit";
		}
	};

	const applyLiveThemeChoice = (choice) => {
		try {
			if (choice === "inherit") localStorage.removeItem(LIVE_THEME_KEY);
			else localStorage.setItem(LIVE_THEME_KEY, choice);
		} catch {}

		liveThemeButtons.forEach((button) => {
			button.setAttribute("aria-pressed", String(button.dataset.themeChoice === choice));
		});
	};

	buttons.forEach((b) => {
		b.addEventListener("click", () => {
			apply(b.dataset.themeChoice);
		});
	});

	liveThemeButtons.forEach((button) => {
		button.addEventListener("click", () => {
			applyLiveThemeChoice(button.dataset.themeChoice);
		});
	});

	apply(getSaved());
	applyLiveThemeChoice(getSavedLiveTheme());
}

setupTheme();
