// FinaHack - Goal Tracking Feature

const GOAL_TRACKING_STORAGE_KEY = 'finaHackGoalTracking';
let userGoal = 0;

// Function to save the user's goal
const saveUserGoal = (goal) => {
  userGoal = goal;
  chrome.storage.local.set({ [GOAL_TRACKING_STORAGE_KEY]: userGoal });
};

// Function to create the goal setting UI
const createGoalSettingUI = () => {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.bottom = '80px';
  container.style.right = '20px';
  container.style.zIndex = '1000';
  container.style.backgroundColor = 'white';
  container.style.padding = '15px';
  container.style.border = '1px solid #ccc';
  container.style.borderRadius = '5px';
  container.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';

  const title = document.createElement('h3');
  title.textContent = 'Financial Goal';
  title.style.marginTop = '0';
  title.style.marginBottom = '10px';

  const input = document.createElement('input');
  input.type = 'number';
  input.placeholder = 'Enter your goal';
  input.style.width = '100%';
  input.style.padding = '8px';
  input.style.boxSizing = 'border-box';
  input.style.marginBottom = '10px';

  const button = document.createElement('button');
  button.textContent = 'Set Goal';
  button.style.width = '100%';
  button.style.padding = '8px';
  button.style.backgroundColor = '#007bff';
  button.style.color = 'white';
  button.style.border = 'none';
  button.style.borderRadius = '5px';
  button.style.cursor = 'pointer';

  button.addEventListener('click', () => {
    const goal = parseFloat(input.value);
    if (!isNaN(goal) && goal > 0) {
      saveUserGoal(goal);
      updateGoalProgress();
    }
  });

  container.appendChild(title);
  container.appendChild(input);
  container.appendChild(button);

  return container;
};

// Function to display the goal progress
const createGoalProgressUI = () => {
  const container = document.createElement('div');
  container.id = 'goal-progress-container';
  container.style.position = 'fixed';
  container.style.bottom = '150px';
  container.style.right = '20px';
  container.style.zIndex = '1000';
  container.style.backgroundColor = 'white';
  container.style.padding = '15px';
  container.style.border = '1px solid #ccc';
  container.style.borderRadius = '5px';
  container.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
  container.style.display = 'none'; // Hidden by default

  const title = document.createElement('h3');
  title.textContent = 'Goal Progress';
  title.style.marginTop = '0';
  title.style.marginBottom = '10px';

  const progressText = document.createElement('p');
  progressText.id = 'goal-progress-text';

  container.appendChild(title);
  container.appendChild(progressText);

  return container;
};

// Function to update the goal progress
const updateGoalProgress = () => {
  if (userGoal > 0) {
    let portfolioValueElement = document.querySelector('._1ennw9q0'); // From user inspection
    if (!portfolioValueElement) {
      portfolioValueElement = document.querySelector('.dashboard-portfolio-value'); // More specific selector
    }
    if (!portfolioValueElement) {
      portfolioValueElement = document.querySelector('._1azjvrp5'); // Fallback selector
    }

    if (portfolioValueElement) {
      const portfolioValueString = portfolioValueElement.textContent.replace(/\s/g, '').replace(',', '.');
      const portfolioValue = parseFloat(portfolioValueString);
      if (!isNaN(portfolioValue)) {
        const progress = (portfolioValue / userGoal) * 100;

        const progressText = document.getElementById('goal-progress-text');
        if (progressText) {
          progressText.textContent = `You are ${progress.toFixed(2)}% of the way to your goal of ${userGoal.toLocaleString()}!`;
        }

        const progressContainer = document.getElementById('goal-progress-container');
        if (progressContainer) {
          progressContainer.style.display = 'block';
        }
      }
    }
  }
};

// Function to initialize the goal tracking feature
const initGoalTracking = () => {
  // Load user goal from chrome.storage.local
  chrome.storage.local.get([GOAL_TRACKING_STORAGE_KEY], (result) => {
    userGoal = result[GOAL_TRACKING_STORAGE_KEY] || 0;
    updateGoalProgress();
  });

  // Inject the UI
  const goalSettingUI = createGoalSettingUI();
  document.body.appendChild(goalSettingUI);

  const goalProgressUI = createGoalProgressUI();
  document.body.appendChild(goalProgressUI);

  // Periodically update the progress
  setInterval(updateGoalProgress, 5000);
};

// Export the init function
window.initGoalTracking = initGoalTracking;
