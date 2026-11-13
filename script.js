(() => {
    "use strict";

    // DOM ELEMENTS
    const display = document.getElementById("display");
    const expressionDisplay = document.getElementById("expression");
    const historyList = document.getElementById("historyList");
    const clearHistoryButton = document.getElementById("clearHistory");
    const themeToggle = document.getElementById("themeToggle");
    const buttons = document.querySelectorAll(".btn");

    // Check that required HTML elements exist
    if (
        !display ||
        !expressionDisplay ||
        !historyList ||
        !clearHistoryButton ||
        !themeToggle
    ) {
        console.error("Calculator HTML elements are missing. Check index.html.");
        return;
    }

    // STATE
    let expression = "";
    let justCalculated = false;

    const HISTORY_KEY = "calcHistory";
    const THEME_KEY = "calcTheme";

    // DISPLAY FUNCTIONS
    function updateDisplay() {
        display.textContent = expression || "0";
        expressionDisplay.textContent = "";
    }

    function showResult(value, originalExpression) {
        display.textContent = formatNumber(value);
        expressionDisplay.textContent = `${originalExpression} =`;
    }

    function formatNumber(value) {
        if (!Number.isFinite(value)) {
            return "Error";
        }

        return Number.parseFloat(value.toPrecision(12)).toString();
    }

    function showError(message = "Invalid expression") {
        display.textContent = message;
        expressionDisplay.textContent = "";
    }

    // INPUT HANDLING
    function appendValue(value) {

        if (justCalculated) {

            if ("0123456789.(".includes(value)) {
                expression = "";
            }

            justCalculated = false;
        }

        // Prevent multiple decimal points in one number
        if (value === ".") {

            const currentNumber = expression
                .split(/[+\-*/()%]/)
                .pop();

            if (currentNumber.includes(".")) {
                return;
            }

            if (currentNumber === "") {
                expression += "0";
            }
        }

        expression += value;
        updateDisplay();
    }

    function clearCalculator() {
        expression = "";
        justCalculated = false;
        updateDisplay();
    }

    function backspace() {

        if (justCalculated) {
            clearCalculator();
            return;
        }

        expression = expression.slice(0, -1);
        updateDisplay();
    }
    
    // SAFE EXPRESSION PARSER
    // No eval() or Function()
    function tokenize(input) {

        const tokens = [];
        let i = 0;

        while (i < input.length) {

            const char = input[i];

            if (/\s/.test(char)) {
                i++;
                continue;
            }

            // Numbers
            if (/[0-9.]/.test(char)) {

                let number = "";

                while (
                    i < input.length &&
                    /[0-9.]/.test(input[i])
                ) {
                    number += input[i];
                    i++;
                }

                if (
                    (number.match(/\./g) || []).length > 1 ||
                    number === "."
                ) {
                    throw new Error("Invalid number");
                }

                tokens.push({
                    type: "number",
                    value: Number(number)
                });

                continue;
            }

            // Operators and brackets
            if ("+-*/()%".includes(char)) {

                tokens.push({
                    type: "operator",
                    value: char
                });

                i++;
                continue;
            }

            throw new Error("Invalid character");
        }

        return tokens;
    }


    function parseExpression(tokens) {

        let position = 0;

        function peek() {
            return tokens[position];
        }

        function consume(value) {

            if (peek()?.value === value) {
                position++;
                return true;
            }

            return false;
        }


        // Numbers, brackets and negative values
        function parsePrimary() {

            if (consume("(")) {

                const value = parseAddSubtract();

                if (!consume(")")) {
                    throw new Error("Missing closing bracket");
                }

                return value;
            }

            if (consume("+")) {
                return parsePrimary();
            }

            if (consume("-")) {
                return -parsePrimary();
            }

            const token = peek();

            if (!token || token.type !== "number") {
                throw new Error("Invalid expression");
            }

            position++;

            return token.value;
        }


        // Percentage
        function parsePercentage() {

            let value = parsePrimary();

            while (consume("%")) {
                value /= 100;
            }

            return value;
        }


        // Multiplication and division
        function parseMultiplyDivide() {

            let value = parsePercentage();

            while (
                peek() &&
                ["*", "/"].includes(peek().value)
            ) {

                const operator = peek().value;
                position++;

                const right = parsePercentage();

                if (operator === "*") {
                    value *= right;
                } else {

                    if (right === 0) {
                        throw new Error("Cannot divide by zero");
                    }

                    value /= right;
                }
            }

            return value;
        }


        // Addition and subtraction
        function parseAddSubtract() {

            let value = parseMultiplyDivide();

            while (
                peek() &&
                ["+", "-"].includes(peek().value)
            ) {

                const operator = peek().value;
                position++;

                const right = parseMultiplyDivide();

                if (operator === "+") {
                    value += right;
                } else {
                    value -= right;
                }
            }

            return value;
        }


        const result = parseAddSubtract();

        if (position !== tokens.length) {
            throw new Error("Invalid expression");
        }

        if (!Number.isFinite(result)) {
            throw new Error("Result out of range");
        }

        return result;
    }


    function safeEvaluate(input) {

        if (!input.trim()) {
            throw new Error("Enter a calculation");
        }

        const tokens = tokenize(input);

        return parseExpression(tokens);
    }

    // CALCULATION
    function calculate() {

        if (!expression) {
            return;
        }

        const originalExpression = expression;

        try {

            const result = safeEvaluate(expression);
            const formattedResult = formatNumber(result);

            addToHistory(originalExpression, formattedResult);

            expression = formattedResult;
            justCalculated = true;

            showResult(result, originalExpression);

        } catch (error) {

            showError(error.message || "Invalid expression");

            justCalculated = false;
        }
    }

    // HISTORY FUNCTIONS
    function getHistory() {

        try {

            const saved = JSON.parse(
                localStorage.getItem(HISTORY_KEY)
            );

            return Array.isArray(saved) ? saved : [];

        } catch (error) {

            console.error("Could not load calculation history:", error);

            return [];
        }
    }


    function saveHistory(history) {

        try {

            localStorage.setItem(
                HISTORY_KEY,
                JSON.stringify(history)
            );

        } catch (error) {

            console.error("Could not save calculation history:", error);
        }
    }


    function addToHistory(calculation, result) {

        const history = getHistory();

        history.unshift({
            calculation: calculation,
            result: result,
            date: new Date().toLocaleString()
        });

        saveHistory(history.slice(0, 30));

        renderHistory();
    }


    function renderHistory() {

        const history = getHistory();

        historyList.replaceChildren();

        if (history.length === 0) {

            const emptyMessage = document.createElement("p");

            emptyMessage.className = "empty-history";
            emptyMessage.textContent =
                "Your calculations will appear here.";

            historyList.appendChild(emptyMessage);

            return;
        }


        history.forEach((item) => {

            const historyItem = document.createElement("div");

            historyItem.className = "history-item";


            const calculation = document.createElement("p");

            calculation.className = "history-calculation";
            calculation.textContent = item.calculation;


            const result = document.createElement("p");

            result.className = "history-result";
            result.textContent = `= ${item.result}`;


            historyItem.append(calculation, result);


            // Click a history entry to reuse its result
            historyItem.addEventListener("click", () => {

                expression = String(item.result);

                justCalculated = true;

                updateDisplay();
            });


            historyList.appendChild(historyItem);

        });
    }


    function clearHistory() {

        try {

            localStorage.removeItem(HISTORY_KEY);

        } catch (error) {

            console.error("Could not clear history:", error);
        }

        renderHistory();
    }

    // DARK / LIGHT THEME
    function applyTheme(theme) {

        document.documentElement.dataset.theme = theme;

        themeToggle.textContent =
            theme === "dark" ? "☀" : "☾";

        themeToggle.setAttribute(
            "aria-label",
            theme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
        );
    }


    function toggleTheme() {

        const currentTheme =
            document.documentElement.dataset.theme || "dark";

        const newTheme =
            currentTheme === "dark" ? "light" : "dark";

        try {

            localStorage.setItem(THEME_KEY, newTheme);

        } catch (error) {

            console.error("Could not save theme preference:", error);
        }

        applyTheme(newTheme);
    }


    function initializeTheme() {

        let savedTheme = "dark";

        try {

            savedTheme =
                localStorage.getItem(THEME_KEY) || "dark";

        } catch (error) {

            console.error("Could not load theme preference:", error);
        }

        if (!["dark", "light"].includes(savedTheme)) {
            savedTheme = "dark";
        }

        applyTheme(savedTheme);
    }

    // BUTTON EVENTS
    buttons.forEach((button) => {

        button.addEventListener("click", () => {

            const action = button.dataset.action;
            const value = button.dataset.value;

            if (action === "clear") {

                clearCalculator();

            } else if (action === "back") {

                backspace();

            } else if (action === "equals") {

                calculate();

            } else if (value !== undefined) {

                appendValue(value);
            }
        });
    });

    // KEYBOARD SUPPORT
    document.addEventListener("keydown", (event) => {

        const key = event.key;

        if (/^[0-9.]$/.test(key)) {

            appendValue(key);

        } else if (
            ["+", "-", "*", "/", "(", ")", "%"].includes(key)
        ) {

            appendValue(key);

        } else if (key === "Enter" || key === "=") {

            event.preventDefault();

            calculate();

        } else if (key === "Backspace") {

            event.preventDefault();

            backspace();

        } else if (key === "Escape") {

            clearCalculator();
        }
    });

    // INITIALIZATION
    clearHistoryButton.addEventListener("click", clearHistory);
    themeToggle.addEventListener("click", toggleTheme);

    initializeTheme();
    renderHistory();
    updateDisplay();

}) ();