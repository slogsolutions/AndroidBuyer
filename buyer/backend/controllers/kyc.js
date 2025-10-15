// backend/controllers/kyc.js
import User from '../models/User.js';

export const submitKYC = async (req, res) => {
  try {
    const {
      fullName,
      dateOfBirth,
      address,
      city,
      state,
      zipCode,
      country,
      idType,
      idNumber,
      phoneNumber,
    } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // In a production environment, you would upload the document to a secure storage
    // and store the URL instead of the file itself
    const idDocumentUrl = req.file ? 'document_url_placeholder' : null;

    user.kycData = {
      fullName,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      address,
      city,
      state,
      zipCode,
      country,
      idType,
      idNumber,
      phoneNumber,
      idDocumentUrl,
    };
    user.kycStatus = 'submitted';
    await user.save();

    res.json({ message: 'KYC submitted successfully', status: 'submitted' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Failed to submit KYC' });
  }
};

export const getKYCStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('kycStatus kycData');
    res.json({
      status: user.kycStatus,
      data: user.kycData,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get KYC status' });
  }
};

// Admin route to get all KYC submissions
export const getAllKYCSubmissions = async (req, res) => {
  try {
    // Only admin should access this
    const user = req.user;
    console.log(user.isAdmin);

    if (!user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Retrieve users and their KYC data directly (without populate)
    const kycSubmissions = await User.find({}, 'name email kycData'); // Select relevant fields
    res.status(200).json(kycSubmissions);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
};

export const approveKYCSubmission = async (req, res) => {
  try {
    const { selectedKycId } = req.params;

    // Find the user and update KYC status to 'approved'
    const updatedUser = await User.findByIdAndUpdate(
      selectedKycId,
      { kycStatus: 'approved' },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({
      message: 'KYC successfully approved',
      user: updatedUser,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
};
