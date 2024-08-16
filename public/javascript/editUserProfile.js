document.addEventListener('DOMContentLoaded', function() {
    // Update Profile Form
    const updateProfileForm = document.getElementById('updateProfileForm');
    if (updateProfileForm) {
        updateProfileForm.addEventListener('submit', handleUpdateProfile);
    }

    // Change Password Form
    const changePasswordForm = document.getElementById('changePasswordForm');
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');
    const confirmNewPasswordInput = document.getElementById('confirm-new-password');
    const currentPasswordError = document.getElementById('currentPasswordError');
    const newPasswordError = document.getElementById('newPasswordError');
    const confirmNewPasswordError = document.getElementById('confirmNewPasswordError');
    
    currentPasswordInput.addEventListener('input', () => {
        currentPasswordError.textContent = '';
        currentPasswordError.style.display = 'none';
    });
    
    newPasswordInput.addEventListener('input', () => {
        const result = validatePassword(newPasswordInput.value, newPasswordError, null);
        if (result) {
            newPasswordError.textContent = '';
            newPasswordError.style.display = 'none';
        }
    });
    
    confirmNewPasswordInput.addEventListener('input', () => {
        if (newPasswordInput.value === confirmNewPasswordInput.value) {
            confirmNewPasswordError.textContent = '';
            confirmNewPasswordError.style.display = 'none';
        } else {
            confirmNewPasswordError.textContent = 'Passwords do not match';
            confirmNewPasswordError.style.display = 'block';
        }
    });

    // Clear error messages when modal is closed
    const changePasswordModal = document.getElementById('changePasswordModal');
    changePasswordModal.addEventListener('hidden.bs.modal', function() {
        clearErrorMessages();
        changePasswordForm.reset();
    });

    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', handleChangePassword);
    }

    async function handleUpdateProfile(e) {
        e.preventDefault();

        const formData = new FormData(this);
        const submitButton = this.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Saving...';
        console.log('Form Data:', formData);

        try {
            const response = await axios.post('/update-profile', Object.fromEntries(formData), {
                headers: {
                    'Content-Type': 'application/json'  
                }
            });

            const result = response.data;

            if (result.success) {
                showFlashMessage('success', 'Profile updated successfully');
                updateFormValues(result.user);
            } else {
                showFlashMessage('error', result.message || 'Failed to update profile');
            }
        } catch (error) {
            console.error('Error:', error);
            showFlashMessage('error', 'An error occurred while updating the profile');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Save Changes';
        }
    }

    async function handleChangePassword(e) {
        e.preventDefault();
    
        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmNewPassword = confirmNewPasswordInput.value;
    
        // Clear previous error messages
        clearErrorMessages();
    
        // Disable submit button and show loading state
        const submitButton = this.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerHTML = 'Changing Password...';
    
        try {
            const response = await axios.post('/change-password', {
                currentPassword,
                newPassword,
                confirmNewPassword
            });
    
            if (response.data.success) {
                // Clear the form
                this.reset();
                
                // Close the modal
                const modal = bootstrap.Modal.getInstance(changePasswordModal);
                modal.hide();
    
                // Display success message
                showFlashMessage('success', 'Password changed successfully');
            } else {
                // If the server sends an error message, display it
                handleErrorMessage(response.data.msg);
            }
        } catch (error) {
            console.error('Error:', error);
            if (error.response) {
                handleErrorMessage(error.response.data.msg);
            } else if (error.request) {
                showFlashMessage('error', 'No response received from the server. Please try again.');
            } else {
                showFlashMessage('error', 'An unexpected error occurred. Please try again.');
            }
        } finally {
            // Re-enable submit button and restore original text
            submitButton.disabled = false;
            submitButton.innerHTML = 'Change Password';
        }
    }
    
    function handleErrorMessage(errorMsg) {
        switch (errorMsg) {
            case 'Current password is incorrect':
                currentPasswordError.textContent = 'The current password you entered is incorrect.';
                currentPasswordError.style.display = 'block';
                break;
            case 'New passwords do not match':
                confirmNewPasswordError.textContent = 'The new passwords you entered do not match.';
                confirmNewPasswordError.style.display = 'block';
                break;
            case 'New password must be different from the current password':
                newPasswordError.textContent = 'Your new password must be different from your current password.';
                newPasswordError.style.display = 'block';
                break;
            case 'New password must be at least 6 characters long and contain at least one uppercase letter, one lowercase letter, and one number':
                newPasswordError.textContent = 'Your new password must be at least 6 characters long and contain at least one uppercase letter, one lowercase letter, and one number.';
                newPasswordError.style.display = 'block';
                break;
            default:
                showFlashMessage('error', errorMsg || 'An error occurred while changing the password. Please try again.');
        }
    }
    
    function clearErrorMessages() {
        currentPasswordError.textContent = '';
        currentPasswordError.style.display = 'none';
        newPasswordError.textContent = '';
        newPasswordError.style.display = 'none';
        confirmNewPasswordError.textContent = '';
        confirmNewPasswordError.style.display = 'none';
    }

    function showFlashMessage(type, message) {
        const flashContainer = document.getElementById('flashMessageContainer');
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type === 'error' ? 'danger' : 'success'} alert-dismissible fade show`;
        alertDiv.role = 'alert';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        flashContainer.appendChild(alertDiv);

        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }

    function updateFormValues(user) {
        document.querySelector('input[name="firstName"]').value = user.firstName;
        document.querySelector('input[name="lastName"]').value = user.lastName;
        document.querySelector('input[name="email"]').value = user.email;
        document.querySelector('input[name="mobile"]').value = user.mobile;
    }
});