document.addEventListener('DOMContentLoaded', () => {
  const updateProfileForm = document.getElementById('updateProfileForm');
  const changePasswordForm = document.getElementById('changePasswordForm');

  if (updateProfileForm) {
      updateProfileForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const formData = new FormData(updateProfileForm);
          try {
              const response = await axios.post('/update-profile', Object.fromEntries(formData));
              if (response.data.success) {
                  Swal.fire('Success', 'Profile updated successfully', 'success');
              } else {
                  Swal.fire('Error', response.data.message, 'error');
              }
          } catch (error) {
              console.error('Error:', error);
              Swal.fire('Error', 'Failed to update profile', 'error');
          }
      });
  }

  if (changePasswordForm) {
      changePasswordForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const formData = new FormData(changePasswordForm);
          try {
              const response = await axios.post('/change-password', Object.fromEntries(formData));
              if (response.data.success) {
                  Swal.fire('Success', 'Password changed successfully', 'success');
                  $('#changePasswordModal').modal('hide');
              } else {
                  Swal.fire('Error', response.data.message, 'error');
              }
          } catch (error) {
              console.error('Error:', error);
              Swal.fire('Error', 'Failed to change password', 'error');
          }
      });
  }

  // Forgot Password
  const forgotPasswordForm = document.getElementById('forgotPasswordForm');
  if (forgotPasswordForm) {
      forgotPasswordForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const email = document.getElementById('forgotPasswordEmail').value;
          try {
              const response = await axios.post('/forgot-password', { email });
              if (response.data.success) {
                  Swal.fire('Success', 'Password reset link sent to your email', 'success');
              } else {
                  Swal.fire('Error', response.data.message, 'error');
              }
          } catch (error) {
              console.error('Error:', error);
              Swal.fire('Error', 'Failed to process forgot password request', 'error');
          }
      });
  }
});
