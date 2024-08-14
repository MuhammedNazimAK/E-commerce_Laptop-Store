document.addEventListener("DOMContentLoaded", function () {
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", validateRegisterForm);
    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirmPassword");

    if (passwordInput) {
      passwordInput.addEventListener("input", validatePassword);
    }
    if (confirmPasswordInput) {
      confirmPasswordInput.addEventListener("input", validateConfirmPassword);
    }
  }

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", validateLoginForm);
  }
});

function validateRegisterForm(event) {
  let isValid = true;
  const fields = [
    {
      id: "firstName",
      validation: isNotEmpty,
      errorMsg: "First name is required",
      invalidMsg: "First name is invalid",
    },
    {
      id: "email",
      validation: isValidEmail,
      errorMsg: "Email is required",
      invalidMsg: "Please enter a valid email address",
    },
    {
      id: "password",
      validation: isValidPassword,
      errorMsg: "Password is required",
      invalidMsg: "Password must be at least 6 characters, including uppercase, lowercase, and a number.",
    },
    {
      id: "confirmPassword",
      validation: (value) => value === document.getElementById("password").value,
      errorMsg: "Confirm password is required",
      invalidMsg: "Passwords do not match",
    },
    {
      id: "mobile",
      validation: isValidMobile,
      errorMsg: "Mobile number is required",
      invalidMsg: "Please enter a valid mobile number",
    },
  ];

  fields.forEach((field) => {
    const input = document.getElementById(field.id);
    const errorElement = document.getElementById(`${field.id}Error`);
    if (!isNotEmpty(input.value)) {
      isValid = false;
      errorElement.textContent = field.errorMsg;
      errorElement.style.display = "block";
    } else if (!field.validation(input.value)) {
      isValid = false;
      errorElement.textContent = field.invalidMsg;
      errorElement.style.display = "block";
    } else {
      errorElement.textContent = "";
      errorElement.style.display = "none";
    }
  });

  if (!isValid) {
    event.preventDefault();
  } else {
    const formData = new FormData(event.target);
    fetch("/signup", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          window.location.href = "/login";
        } else {
          handleServerError(data.errors);
        }
      })
      .catch((error) => console.error("Error:", error));
  }
}

function validateLoginForm(event) {
  let isValid = true;

  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const emailError = document.getElementById("emailError");
  const passwordError = document.getElementById("passwordError");

  // Reset error messages
  emailError.style.display = "none";
  passwordError.style.display = "none";

  if (!isNotEmpty(email.value)) {
    isValid = false;
    emailError.textContent = "Email is required";
    emailError.style.display = "block";
  } else if (!isValidEmail(email.value)) {
    isValid = false;
    emailError.textContent = "Please enter a valid email address";
    emailError.style.display = "block";
  }

  if (!isNotEmpty(password.value)) {
    isValid = false;
    passwordError.textContent = "Password is required";
    passwordError.style.display = "block";
  }

  if (!isValid) {
    event.preventDefault();
  } else {
    const formData = new FormData(event.target);
    fetch("/login", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          window.location.href = "/home";
        } else {
          handleServerError(data.errors);
        }
      })
      .catch((error) => console.error("Error:", error));
  }
}

function validatePassword() {
  const password = document.getElementById("password").value;
  const passwordError = document.getElementById("passwordError");

  const conditions = [
    {
      test: /[a-z]/,
      message: "Password must include at least one lowercase letter.",
    },
    {
      test: /[A-Z]/,
      message: "Password must include at least one uppercase letter.",
    },
    {
      test: /\d/,
      message: "Password must include at least one number.",
    },
    {
      test: /.{6,}/,
      message: "Password must be at least 6 characters long.",
    },
  ];

  const failedCondition = conditions.find(
    (condition) => !condition.test.test(password)
  );

  if (failedCondition) {
    passwordError.textContent = failedCondition.message;
    passwordError.style.display = "block";
  } else {
    passwordError.textContent = "";
    passwordError.style.display = "none";
  }
}

function validateConfirmPassword() {
  const confirmPassword = document.getElementById("confirmPassword").value;
  const password = document.getElementById("password").value;
  const confirmPasswordError = document.getElementById("confirmPasswordError");

  if (confirmPassword !== password) {
    confirmPasswordError.textContent = "Passwords do not match";
    confirmPasswordError.style.display = "block";
  } else {
    confirmPasswordError.textContent = "";
    confirmPasswordError.style.display = "none";
  }
}

function isNotEmpty(value) {
  const result = value.trim() !== "";
  console.log(`isNotEmpty(${value}) = ${result}`);
  return result;
}

function isValidEmail(value) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(value);
}

function isValidPassword(value) {
  const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{6,}$/;
  return passwordPattern.test(value);
}

function isValidMobile(value) {
  const mobilePattern = /^[0-9]{10}$/;
  return mobilePattern.test(value);
}

function handleServerError(errors) {
  console.log("Server errors:", errors);
  for (const field in errors) {
    const errorElement = document.getElementById(`${field}Error`);
    if (errorElement) {
      errorElement.textContent = errors[field];
      errorElement.style.display = "block";
    }
  }
}
