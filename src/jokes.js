// Curated witty finance, banking, Wall Street, and Arla-themed jokes
export const financeJokes = [
  {
    category: "Banking",
    setup: "Why did the banker break up with his girlfriend?",
    punchline: "He just lost interest."
  },
  {
    category: "Philosophy",
    setup: "A bank is a place that will lend you money...",
    punchline: "If you can prove that you don't need it!"
  },
  {
    category: "Wall Street",
    setup: "What’s the difference between an investment banker and a large pizza?",
    punchline: "A large pizza can feed a family of four."
  },
  {
    category: "Economics",
    setup: "Why is money called dough?",
    punchline: "Because we all knead it."
  },
  {
    category: "Inflation",
    setup: "What is inflation?",
    punchline: "The only thing going up around here without any extra effort."
  },
  {
    category: "Arla Special",
    setup: "Why did the dairy farmer invest in the stock market?",
    punchline: "He wanted to milk his capital gains for all they're worth."
  },
  {
    category: "Accounting",
    setup: "How do you know an accountant is an extrovert?",
    punchline: "They look at your shoes while talking to you instead of their own."
  },
  {
    category: "Crypto",
    setup: "Why did the crypto trader cross the road?",
    punchline: "To buy the dip on the other side... and regret it immediately."
  },
  {
    category: "Budgeting",
    setup: "My budget is like a submarine screen door...",
    punchline: "Technically in place, but not keeping anything afloat."
  },
  {
    category: "Arla Special",
    setup: "What kind of cheese makes the best financial advisor?",
    punchline: "Gouda investments only. Anything else would be un-brie-lievable!"
  },
  {
    category: "Loans",
    setup: "Why do loan sharks make terrible drivers?",
    punchline: "They never back down from a collision course."
  },
  {
    category: "Trading",
    setup: "Rule #1 of day trading:",
    punchline: "Buy high, sell low, blame the Federal Reserve."
  },
  {
    category: "Wealth",
    setup: "What's the best way to make a small fortune in the market?",
    punchline: "Start with a very large fortune."
  },
  {
    category: "Arla Special",
    setup: "Why did the organic cow get promoted to Chief Financial Officer?",
    punchline: "Her balance sheets were totally pasture expectations."
  },
  {
    category: "Pensions",
    setup: "Retirement plan update:",
    punchline: "Hoping that treasure maps make a comeback."
  },
  {
    category: "Credit Cards",
    setup: "Why are credit cards like toddlers?",
    punchline: "They run away with your sanity and demand constant interest."
  },
  {
    category: "Economics",
    setup: "Why did the economist bring a ladder to the market?",
    punchline: "To reach the floating exchange rate."
  },
  {
    category: "Savings",
    setup: "I told my financial planner I want to live like a king...",
    punchline: "He told me: 'Fine, off with your head when bills arrive!'"
  }
];

export function getRandomJoke(excludeIndex = -1) {
  let index;
  do {
    index = Math.floor(Math.random() * financeJokes.length);
  } while (index === excludeIndex && financeJokes.length > 1);
  return { joke: financeJokes[index], index };
}
