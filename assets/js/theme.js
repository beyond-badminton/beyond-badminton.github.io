// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

function setupTheme() {
	var root = document.documentElement;
	var buttons = document.querySelectorAll("[data-theme-choice]");

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

	buttons.forEach((b) => {
		b.addEventListener("click", () => {
			apply(b.dataset.themeChoice);
		});
	});

	apply(getSaved());
}

setupTheme();
