const validator = require('validator');

/**
 * Checks password strength and returns a detailed result.
 */
const checkPasswordStrength = (password) => {
  const errors = {
    length: null,
    hasUpperCase: null,
    hasLowerCase: null,
    hasNumbers: null,
    hasSpecialChar: null,
  };

  let score = 0;

  if (password.length < 8) {
    errors.length = 'Password must be at least 8 characters long';
  } else {
    score++;
  }

  if (!/[A-Z]/.test(password)) {
    errors.hasUpperCase = 'Password must contain at least one uppercase letter';
  } else {
    score++;
  }

  if (!/[a-z]/.test(password)) {
    errors.hasLowerCase = 'Password must contain at least one lowercase letter';
  } else {
    score++;
  }

  if (!/\d/.test(password)) {
    errors.hasNumbers = 'Password must contain at least one number';
  } else {
    score++;
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.hasSpecialChar = 'Password must contain at least one special character';
  } else {
    score++;
  }

  const normalizedScore = score / 5;
  return {
    score: normalizedScore,
    strong: normalizedScore >= 0.8,
    errors,
  };
};

/**
 * Validates user input either for full creation or partial updates.
 */
const validateUserInput = (input, isPartialUpdate = false) => {
  const errors = [];

  // Full creation validations
  if (!isPartialUpdate) {
    if (!input.firstName || validator.isEmpty(input.firstName.trim())) {
      errors.push('First name is required');
    }

    if (!input.lastName || validator.isEmpty(input.lastName.trim())) {
      errors.push('Last name is required');
    }

    if (!input.email || !validator.isEmail(input.email)) {
      errors.push('Valid email is required');
    }

    if (!input.password) {
      errors.push('Password is required');
    } else {
      const result = checkPasswordStrength(input.password);
      if (!result.strong) {
        errors.push('Password does not meet strength requirements');
      }
    }

    if (!input.contactNumber || input.contactNumber.trim() === '') {
      errors.push('Contact number is required');
    }

    if (!input.houseAddress || validator.isEmpty(input.houseAddress.trim())) {
      errors.push('House address is required');
    }
  }

  // Optional/partial update validations
  if (input.firstName && validator.isEmpty(input.firstName.trim())) {
    errors.push('First name cannot be empty');
  }

  if (input.lastName && validator.isEmpty(input.lastName.trim())) {
    errors.push('Last name cannot be empty');
  }

  if (input.email && !validator.isEmail(input.email)) {
    errors.push('Invalid email format');
  }

  if (input.password) {
    const result = checkPasswordStrength(input.password);
    if (!result.strong) {
      errors.push('Password does not meet strength requirements');
    }
  }

  if (input.contactNumber && input.contactNumber.trim() === '') {
    errors.push('Contact number cannot be empty');
  }

  if (input.houseAddress && validator.isEmpty(input.houseAddress.trim())) {
    errors.push('House address cannot be empty');
  }

  return errors;
};

module.exports = {
  checkPasswordStrength,
  validateUserInput,
};