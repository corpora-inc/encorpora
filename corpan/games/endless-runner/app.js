(function () {
  const registry = (window.CorpanGames = window.CorpanGames || {});

  registry["endless-runner"] = {
    mount: (container, hostApi, initialState) => {
      const root = document.createElement("div");
      root.className = "corp-runner";

      const header = document.createElement("header");
      const title = document.createElement("div");
      title.className = "title";
      title.textContent = "Echo Sprint";
      const stack = document.createElement("div");
      stack.className = "stack";

      header.appendChild(title);
      header.appendChild(stack);

      const arena = document.createElement("div");
      arena.className = "arena";

      const prompt = document.createElement("div");
      prompt.className = "prompt";

      const subtitle = document.createElement("div");
      subtitle.className = "subtitle";
      subtitle.textContent = "Listen and run through the correct phrase.";

      const lanes = document.createElement("div");
      lanes.className = "lanes";

      const status = document.createElement("div");
      status.className = "status";

      const scoreEl = document.createElement("div");
      const streakEl = document.createElement("div");
      status.appendChild(scoreEl);
      status.appendChild(streakEl);

      const ticker = document.createElement("div");
      ticker.className = "ticker";
      const tickerFill = document.createElement("span");
      ticker.appendChild(tickerFill);

      const footer = document.createElement("div");
      footer.className = "status";

      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = "Use arrow keys or 1-3 to choose a lane.";

      const speakBtn = document.createElement("button");
      speakBtn.className = "btn";
      speakBtn.textContent = "Replay";

      footer.appendChild(hint);
      footer.appendChild(speakBtn);

      arena.appendChild(prompt);
      arena.appendChild(subtitle);
      arena.appendChild(lanes);
      arena.appendChild(ticker);
      arena.appendChild(status);

      root.appendChild(header);
      root.appendChild(arena);
      root.appendChild(footer);
      container.appendChild(root);

      const baseStack = (initialState && initialState.stackConfig) || {
        languages: ["en", "es"],
        domains: [],
        levels: [],
        rate: 1,
      };

      const speakLang = baseStack.languages[0] || "en";
      const targetLang = baseStack.languages[1] || "es";

      stack.textContent = `${speakLang} -> ${targetLang}`;

      const phrases = [
        {
          prompt: "hola",
          choices: ["hello", "hollow", "halo"],
          answer: 0,
        },
        {
          prompt: "adios",
          choices: ["adios", "bye", "adieu"],
          answer: 1,
        },
        {
          prompt: "gracias",
          choices: ["grassy", "gracias", "thanks"],
          answer: 2,
        },
      ];

      let currentIndex = 0;
      let locked = false;
      let score = 0;
      let streak = 0;
      let laneButtons = [];

      const renderLane = (label, index) => {
        const lane = document.createElement("div");
        lane.className = "lane";
        lane.textContent = label;
        lane.dataset.index = String(index);
        lane.addEventListener("click", () => selectLane(index));
        return lane;
      };

      const announcePrompt = () => {
        const phrase = phrases[currentIndex];
        if (phrase) {
          hostApi.speak(speakLang, phrase.prompt);
        }
      };

      const renderRound = () => {
        const phrase = phrases[currentIndex];
        if (!phrase) {
          return;
        }
        prompt.textContent = phrase.prompt;
        lanes.innerHTML = "";
        laneButtons = phrase.choices.map((choice, idx) => renderLane(choice, idx));
        laneButtons.forEach((lane) => lanes.appendChild(lane));
        scoreEl.textContent = `Score ${score}`;
        streakEl.textContent = `Streak ${streak}`;
        locked = false;
        announcePrompt();
      };

      const nextRound = () => {
        currentIndex = (currentIndex + 1) % phrases.length;
        tickerFill.style.animation = "none";
        void tickerFill.offsetHeight;
        tickerFill.style.animation = "ticker 6s linear infinite";
        renderRound();
      };

      const selectLane = (index) => {
        if (locked) {
          return;
        }
        locked = true;
        const phrase = phrases[currentIndex];
        laneButtons.forEach((lane, idx) => {
          lane.classList.toggle("active", idx === index);
          if (idx === phrase.answer) {
            lane.classList.add("correct");
          } else if (idx === index) {
            lane.classList.add("wrong");
          }
        });
        if (index === phrase.answer) {
          score += 10;
          streak += 1;
        } else {
          streak = 0;
        }
        setTimeout(nextRound, 900);
      };

      const onKey = (event) => {
        if (event.key === "ArrowLeft" || event.key === "1") {
          selectLane(0);
        }
        if (event.key === "ArrowUp" || event.key === "2") {
          selectLane(1);
        }
        if (event.key === "ArrowRight" || event.key === "3") {
          selectLane(2);
        }
      };

      window.addEventListener("keydown", onKey);
      speakBtn.addEventListener("click", announcePrompt);

      renderRound();

      return {
        unmount: () => {
          window.removeEventListener("keydown", onKey);
          speakBtn.removeEventListener("click", announcePrompt);
          container.removeChild(root);
        },
      };
    },
  };
})();
