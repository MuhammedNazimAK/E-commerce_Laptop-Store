document.getElementById('resetPasswordForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  // Clear previous error messages
  document.getElementById('confirmPasswordError').textContent = "";
  document.getElementById('serverError').textContent = "";
  
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const token = window.location.pathname.split('/').pop(); // Get token from URL
  
  if (password !== confirmPassword) {
      document.getElementById('confirmPasswordError').textContent = "Passwords do not match";
      return;
  }
  
  try {
      const response = await fetch(`/reset-password/${token}`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({
              password,
          }),
      });
      const data = await response.json();
      if (data.success) {
          const successMessage = document.getElementById('successMessage');
          successMessage.innerHTML = `${data.message}<br>Redirecting to login page in <span id="countdown">5</span> seconds...`;
          successMessage.style.display = 'block';
          document.getElementById('serverError').style.display = 'none';
          startCountdown(5, 'countdown', () => {
              window.location.href = '/login';
          });
      } else {
          document.getElementById('serverError').textContent = data.message;
          document.getElementById('serverError').style.display = 'block';
      }
  } catch (error) {
      console.error(error);
      document.getElementById('serverError').textContent = 'An error occurred while resetting password';
      document.getElementById('serverError').style.display = 'block';
  }
});