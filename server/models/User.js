import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const trustedContactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  priority: {
    type: String,
    enum: ['primary', 'secondary'],
    default: 'primary'
  }
});

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  trustedContacts: {
    type: [trustedContactSchema],
    default: [],
    validate: [
      {
        validator: function(val) {
          return val.length <= 5;
        },
        message: 'You can have a maximum of 5 trusted contacts.'
      }
    ]
  },
  emergencyMessage: {
    type: String,
    default: 'I need help. This is my live location.'
  },
  dailySosEmailsCount: {
    type: Number,
    default: 0
  },
  lastSosEmailDate: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving if it has been modified
userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash') && !this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    if (this.password) {
      this.passwordHash = await bcrypt.hash(this.password, salt);
      // Delete plain text password property
      this.password = undefined;
    } else if (this.passwordHash && !this.passwordHash.startsWith('$2b$')) {
      this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

const User = mongoose.model('User', userSchema);
export default User;
