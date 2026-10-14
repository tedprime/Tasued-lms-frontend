import { AIIE_COURSE_ID } from "./ids";

/**
 * AIIE 111 question banks, one per part of the handout. Written from the handout's content and its
 * Module 15 practice questions (15.4 — marked "15.4" below; answer key 1B 2C 3A 4B 5D 6C 7A 8C 9B 10B).
 *
 * sc = single choice (correct index), mc = multiple choice (correct indexes), tf = true/false,
 * sa = short answer (accepted answers; empty => manual marking), es = essay (points).
 */
export type Q =
  | ["sc", string, string[], number, string?]
  | ["mc", string, string[], number[], string?]
  | ["tf", string, boolean, string?]
  | ["sa", string, string[], string?]
  | ["es", string, number];

export interface BankData {
  id: string;
  courseId: string;
  name: string;
  tags: string[];
  questions: Q[];
}

const OFF = AIIE_COURSE_ID;

export const BANKS: BankData[] = [
  {
    id: "bank-aiie-part-a", courseId: OFF, name: "Part A · Understanding AI (Modules 1–5)", tags: ["part-a"],
    questions: [
      ["sc", "Which statement best describes the relationship between AI, machine learning and deep learning?", ["They are three names for the same thing.", "Deep learning is a type of machine learning, which is a type of AI.", "AI is a type of machine learning.", "Machine learning and deep learning are unrelated approaches."], 1, "Each term is a subset of the one before it: generative AI ⊂ deep learning ⊂ machine learning ⊂ AI (Unit 1.1). Practice question 15.4 (1)."],
      ["sc", "The Dartmouth Workshop of 1956 is significant because it:", ["produced the first chat assistant.", "introduced the Turing Test.", "launched AI as a named field of research.", "ended the first AI winter."], 2, "McCarthy coined the term “artificial intelligence” for the 1956 workshop proposal (Unit 2.1). Practice question 15.4 (2)."],
      ["sc", "A model trained on labelled examples of spam and non-spam emails is an example of:", ["supervised learning.", "unsupervised learning.", "reinforcement learning.", "rule-based AI."], 0, "The examples carry the correct answer (the label), so this is supervised learning (Unit 3.4). Practice question 15.4 (3)."],
      ["sc", "Why do large language models sometimes produce fabricated references?", ["They are programmed to deceive users.", "They generate plausible text rather than retrieving verified facts.", "Their databases of references are out of date.", "Users type prompts incorrectly."], 1, "An LLM predicts a plausible continuation; a plausible continuation is not necessarily a true one (Units 4.2 and 4.5). Practice question 15.4 (4)."],
      ["sc", "“Use only Nigerian examples and keep it under 150 words” is which component of a prompt?", ["Role", "Task", "Context", "Constraints"], 3, "Constraints set limits on tone, level, content or approach (Unit 5.2). Practice question 15.4 (5)."],
      ["tf", "A calculator that always gives the same output for the same input is an example of AI.", false, "Fixed instructions with no learning are automation, not AI (Unit 1.1)."],
      ["mc", "Which of these are core capabilities of AI described in Unit 1.2? (Select all that apply)", ["Perception", "Language", "Prediction", "Consciousness"], [0, 1, 2], "The core capabilities are perception, language, reasoning and planning, prediction and generation."],
      ["sc", "The first AI winter of the 1970s happened mainly because…", ["early successes did not scale to the messy real world and governments cut funding", "computers became too cheap to sell", "the transformer had not been invented yet", "chat assistants spread misinformation"], 0, "Programs that worked on “toy” problems failed in the real world; funding was cut (Unit 2.2)."],
      ["sa", "What term describes AI output that is fluent and confident but false, such as an invented reference?", ["hallucination", "a hallucination", "hallucinations"], "See Unit 4.5."],
      ["sc", "A model that memorises its training examples and performs poorly on new data is said to be…", ["underfitting", "overfitting", "generalising", "reinforcing"], 1, "Overfitting means memorising the training data, including its random quirks (Unit 3.3)."],
      ["sc", "Which neural-network design, introduced in the 2017 paper “Attention Is All You Need”, became the foundation of large language models?", ["The expert system", "The transformer", "The perceptron", "The decision tree"], 1, "See Unit 2.3."],
      ["tf", "Every AI system in use today, including chat assistants, is narrow AI.", true, "They perform a limited range of tasks and have no independent goals (Unit 3.1)."],
      ["sc", "Telling the AI to base its answer only on lecture notes you paste in is called…", ["few-shot prompting", "grounding", "fine-tuning", "zero-shot prompting"], 1, "Providing source material is called grounding; it reduces, but does not remove, hallucination (Unit 5.3)."],
      ["sa", "As a rough guide, 100 tokens is about how many English words?", ["75", "about 75", "75 words", "seventy-five", "seventy five"], "See Unit 4.2."],
      ["sa", "Define hallucination in generative AI and give one example. (Practice question 15.4, Section B)", []],
      ["es", "Distinguish between overfitting and underfitting, and explain why developers test a model on data it has never seen. (Practice question 15.4, Section B)", 4],
    ],
  },
  {
    id: "bank-aiie-part-b", courseId: OFF, name: "Part B · AI for Productivity and Learning (Modules 6–7)", tags: ["part-b"],
    questions: [
      ["sc", "Which AI assistant is built into Microsoft 365 apps such as Word, PowerPoint and Excel?", ["Copilot", "Gemini", "Gamma", "Canva"], 0, "See Unit 6.1."],
      ["sc", "According to Unit 6.2, the best way to keep your own voice when AI helps with writing is to…", ["write your own draft and use AI as an editor, accepting only changes that keep it sounding like you", "ask AI for complete paragraphs and paste them in", "avoid AI for all writing", "use the most polished version AI produces"], 0, "Use AI as an editor, not an author."],
      ["tf", "A good slide contains the full text of what the speaker will say.", false, "Slides support the speaker; they do not replace them — one idea per slide (Unit 6.3)."],
      ["sc", "Which formula returns “Pass” when the total in D2 is 40 or more?", ["=IF(D2>=40,\"Pass\",\"Fail\")", "=IF(D2>40,\"Pass\",\"Fail\")", "=SUM(D2:D40)", "=COUNTIF(D2,\"Pass\")"], 0, "“>” instead of “>=” is a classic edge-case error (Unit 6.4)."],
      ["sc", "Why should you test an AI-written formula on a score of exactly 40 or exactly 70?", ["Those edge cases are where wrong comparisons hide", "Spreadsheets cannot store round numbers", "AI only works with even numbers", "It makes the chart look better"], 0, "See “Verifying results” in Unit 6.4."],
      ["mc", "When does Unit 6.5 say it is better NOT to use AI? (Select all that apply)", ["When checking would take longer than doing the task", "When the task is the learning", "When the material is confidential", "When you need a first draft of a formal letter"], [0, 1, 2], "Also when accuracy is critical and hard to check, or the task is personal."],
      ["sc", "Testing yourself by recalling information from memory is called…", ["retrieval practice", "spacing", "highlighting", "re-reading"], 0, "Retrieval practice and spacing are among the most effective study techniques (Unit 7.2)."],
      ["sc", "A reference produced by AI may be cited only when you have…", ["found the actual source and confirmed that it says what you are citing it for", "checked that the authors’ names sound real", "asked the AI whether the reference is real", "found the journal’s website"], 0, "Search, match, open, confirm — any failure means do not cite it (Unit 7.4)."],
      ["sa", "Which source-evaluation criterion asks “When was it published? Is the information still current for your topic?”", ["currency"], "Authority, currency and relevance (Unit 7.4)."],
      ["tf", "General chat assistants are reliable for finding academic sources on their own.", false, "They may fabricate references; use academic search tools (Unit 7.3)."],
      ["sc", "Which resource hosts research on African and Nigerian topics that global tools may miss?", ["African Journals Online (AJOL)", "Google Maps", "PowerPoint Designer", "A spreadsheet template"], 0, "See Unit 7.3."],
      ["es", "Explain the difference between using AI to support learning and using it to replace learning. Give one example of each from your own courses (Unit 7.5).", 4],
    ],
  },
  {
    id: "bank-aiie-part-c", courseId: OFF, name: "Part C · Entrepreneurship and Opportunity (Modules 8–9)", tags: ["part-c"],
    questions: [
      ["sc", "In needs finding, which is an open, non-leading question?", ["Wouldn’t an app make revision easier?", "Would you pay ₦1,000 for this?", "Tell me about the last time you revised for an exam.", "Don’t you find the library too crowded?"], 2, "Ask about past behaviour and specific experiences (Unit 9.2). Practice question 15.4 (6)."],
      ["sc", "A teacher who introduces a new peer-tutoring system in their school is practising…", ["intrapreneurship", "social entrepreneurship", "edupreneurship only", "self-plagiarism"], 0, "Intrapreneurship is innovating inside an existing organisation (Unit 8.1)."],
      ["mc", "Which are the four questions of the opportunity screen in Unit 8.4? (Select all that apply)", ["Need", "Market", "Feasibility", "Resources", "Popularity on social media"], [0, 1, 2, 3]],
      ["sc", "Which is the correct order of the five stages of design thinking?", ["Empathise, define, ideate, prototype, test", "Ideate, prototype, test, define, empathise", "Define, empathise, test, ideate, prototype", "Prototype, test, ideate, define, empathise"], 0, "The stages form a loop: testing often sends you back (Unit 9.3)."],
      ["tf", "A good problem statement names the solution you plan to build.", false, "It describes the need without naming a solution (Unit 9.3)."],
      ["sa", "Complete the problem-statement formula: “[User] needs a way to [need] because [______].”", ["insight", "[insight]", "an insight"], "See Unit 9.3."],
      ["es", "Write a problem statement using the user–need–insight formula for a problem of your choice. (Practice question 15.4, Section B)", 3],
      ["es", "Using the stages of design thinking, explain how a group of students could develop a solution to a problem faced by first-year students on campus. (Practice question 15.4, Section C)", 6],
    ],
  },
  {
    id: "bank-aiie-part-d", courseId: OFF, name: "Part D · Responsible and Lawful Use (Modules 10–12)", tags: ["part-d"],
    questions: [
      ["sc", "A hiring model trained on past employees’ CVs rates candidates from certain schools lower. This bias entered mainly through:", ["data.", "deployment.", "hardware.", "prompting."], 0, "The training data reflects past decisions (Unit 10.2). Practice question 15.4 (7)."],
      ["sc", "Under Nigeria’s Copyright Act 2022, copyright in a literary work generally lasts for:", ["20 years from publication.", "50 years from publication.", "the author’s life plus 70 years.", "as long as the work is registered."], 2, "See Unit 11.1. Practice question 15.4 (8)."],
      ["sc", "Which body enforces the Nigeria Data Protection Act 2023?", ["Nigerian Copyright Commission", "Nigeria Data Protection Commission", "National Bureau of Statistics", "Nigerian Communications Commission"], 1, "The NDPC is the regulator (Unit 12.2). Practice question 15.4 (9)."],
      ["tf", "Removing gender and ethnicity from training data is enough to remove bias from a model.", false, "Other features, such as name, school or location, can act as proxies (Unit 10.2)."],
      ["sc", "Submitting text that an AI tool generated as if you wrote it yourself is…", ["a form of academic misconduct, even though no human author was copied", "acceptable if no plagiarism checker flags it", "fair dealing under the Copyright Act", "only a problem in examinations"], 0, "See “AI-assisted plagiarism” in Unit 11.3."],
      ["mc", "Which of these are principles of the NDPA 2023? (Select all that apply)", ["Purpose limitation", "Data minimisation", "Storage limitation", "Collect as much data as possible"], [0, 1, 2], "See the principles table in Unit 12.2."],
      ["sa", "What is the name for synthetic media that realistically shows a person saying or doing something they never said or did?", ["deepfake", "a deepfake", "deepfakes", "deep fake"], "See Unit 10.3."],
      ["sc", "Under the NDPA, a controller must notify the NDPC of a breach likely to risk people’s rights within…", ["24 hours", "72 hours", "7 days", "30 days"], 1, "See “Breaches and accountability” in Unit 12.2."],
      ["es", "A secondary school teacher pastes her class’s names and examination scores into a free AI chat assistant and asks it to write a comment on each learner’s report card. Identify the issues this raises and advise her on a better approach. (Practice question 15.4, Section C)", 6],
      ["es", "Give two reasons why an AI-detection score alone should not be treated as proof of academic misconduct. (Practice question 15.4, Section B)", 2],
    ],
  },
  {
    id: "bank-aiie-part-e", courseId: OFF, name: "Part E · Future, Practice and Assessment (Modules 13–15)", tags: ["part-e"],
    questions: [
      ["sc", "An AI tool that drafts lesson notes which a teacher then reviews and edits is an example of:", ["automation.", "augmentation.", "general AI.", "a human-led task."], 1, "AI helps a person do the task while the person directs and checks it (Unit 13.1). Practice question 15.4 (10)."],
      ["sc", "In the reflection structure “What? So what? Now what?”, the “Now what?” part asks you to…", ["state what you will do differently or next as a result", "describe what you did", "list the tools you used", "give your final grade"], 0, "See Unit 14.3."],
      ["tf", "Unlike earlier waves of automation, generative AI particularly affects knowledge work such as writing and analysis.", true, "See Unit 13.1."],
      ["sc", "In an examination, the command words “discuss” and “evaluate” ask you to…", ["consider more than one side and reach a reasoned judgement", "give a one-word answer", "copy the definition from the handout", "list as many facts as possible"], 0, "See Unit 15.3."],
      ["es", "“AI will replace teachers.” Discuss this statement. (Practice question 15.4, Section C)", 10],
    ],
  },
];
