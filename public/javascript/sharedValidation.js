function isValidPassword(value) {
  const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{6,}$/;
  return passwordPattern.test(value);
}

function validatePassword(password, passwordError, passwordStrength) {
  const conditions = [  
    { test: /[a-z]/, message: "lowercase letter" },
    { test: /[A-Z]/, message: "uppercase letter" },
    { test: /\d/, message: "number" },
    { test: /.{6,}/, message: "at least 6 characters" },
  ];

  const passedConditions = conditions.filter((condition) => condition.test.test(password));
  const strength = passedConditions.length;

  if (passwordStrength) {
    if (strength === 0) {
      passwordStrength.textContent = "Very Weak";
      passwordStrength.className = "password-strength weak";
    } else if (strength < 3) {
      passwordStrength.textContent = "Weak";
      passwordStrength.className = "password-strength weak";
    } else if (strength === 3) {
      passwordStrength.textContent = "Medium";
      passwordStrength.className = "password-strength medium";
    } else {
      passwordStrength.textContent = "Strong";
      passwordStrength.className = "password-strength strong";
    }
  }

  if (strength < 4) {
    passwordError.textContent = `Password must include: ${conditions
      .filter((condition) => !condition.test.test(password))
      .map((condition) => condition.message)
      .join(", ")}`;
    passwordError.style.display = "block";
    return false;
  } else {
    passwordError.style.display = "none";
    return true;
  }
}

function validateConfirmPassword(password, confirmPassword, confirmPasswordError) {
  if (password !== confirmPassword) {
    confirmPasswordError.textContent = "Passwords do not match";
    confirmPasswordError.style.display = "block";
    return false;
  } else {
    confirmPasswordError.style.display = "none";
    return true;
  }
}
