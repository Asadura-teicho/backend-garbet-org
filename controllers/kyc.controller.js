  // // const User = require('../models/User.model');
  // // const { getFileUrl, deleteFile } = require('../utils/upload');

  // // // -------------------------------------------
  // // // Submit KYC (non-file data if needed)
  // // // -------------------------------------------
  // // exports.submitKYC = async (req, res) => {
  // //   try {
  // //     const user = await User.findById(req.user.id);
  // //     if (!user) {
  // //       return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
  // //     }

  // //     user.kycStatus = 'pending';
  // //     await user.save();

  // //     res.json({
  // //       message: 'KYC gönderildi',
  // //       kycStatus: user.kycStatus,
  // //     });
  // //   } catch (error) {
  // //     res.status(500).json({ message: error.message });
  // //   }
  // // };

  // // // -------------------------------------------
  // // // Get user KYC
  // // // -------------------------------------------
  // // exports.getKYC = async (req, res) => {
  // //   try {
  // //     const user = await User.findById(req.user.id).select('kycStatus kycDocuments');

  // //     if (!user) {
  // //       return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
  // //     }

  // //     res.json({
  // //       kycStatus: user.kycStatus,
  // //       documents: {
  // //         idFront: user.kycDocuments?.idFront
  // //           ? getFileUrl(user.kycDocuments.idFront)
  // //           : null,
  // //         idBack: user.kycDocuments?.idBack
  // //           ? getFileUrl(user.kycDocuments.idBack)
  // //           : null,
  // //         addressProof: user.kycDocuments?.addressProof
  // //           ? getFileUrl(user.kycDocuments.addressProof)
  // //           : null,
  // //       },
  // //     });
  // //   } catch (error) {
  // //     res.status(500).json({ message: error.message });
  // //   }
  // // };

  // // // -------------------------------------------
  // // // Upload KYC documents (FILES)
  // // // -------------------------------------------
  // // exports.uploadKYCDocuments = async (req, res) => {
  // //   try {
  // //     if (!req.files || Object.keys(req.files).length === 0) {
  // //       return res.status(400).json({ message: 'Lütfen en az bir dosya yükleyin' });
  // //     }

  // //     const user = await User.findById(req.user.id);
  // //     if (!user) {
  // //       return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
  // //     }

  // //     // ID Front
  // //     if (req.files.idFront?.[0]) {
  // //       if (user.kycDocuments?.idFront) {
  // //         deleteFile(user.kycDocuments.idFront);
  // //       }
  // //       user.kycDocuments.idFront = req.files.idFront[0].filename;
  // //     }

  // //     // ID Back
  // //     if (req.files.idBack?.[0]) {
  // //       if (user.kycDocuments?.idBack) {
  // //         deleteFile(user.kycDocuments.idBack);
  // //       }
  // //       user.kycDocuments.idBack = req.files.idBack[0].filename;
  // //     }

  // //     // Address Proof
  // //     if (req.files.addressProof?.[0]) {
  // //       if (user.kycDocuments?.addressProof) {
  // //         deleteFile(user.kycDocuments.addressProof);
  // //       }
  // //       user.kycDocuments.addressProof = req.files.addressProof[0].filename;
  // //     }

  // //     user.kycStatus = 'pending';
  // //     await user.save();

  // //     res.json({
  // //       message: 'KYC belgeleri başarıyla yüklendi',
  // //       kycStatus: user.kycStatus,
  // //       documents: {
  // //         idFront: user.kycDocuments?.idFront
  // //           ? getFileUrl(user.kycDocuments.idFront)
  // //           : null,
  // //         idBack: user.kycDocuments?.idBack
  // //           ? getFileUrl(user.kycDocuments.idBack)
  // //           : null,
  // //         addressProof: user.kycDocuments?.addressProof
  // //           ? getFileUrl(user.kycDocuments.addressProof)
  // //           : null,
  // //       },
  // //     });
  // //   } catch (error) {
  // //     res.status(500).json({ message: error.message });
  // //   }
  // // };

  // // // -------------------------------------------
  // // // Admin get KYC
  // // // -------------------------------------------
  // // exports.getKYCForAdmin = async (req, res) => {
  // //   try {
  // //     const user = await User.findById(req.params.userId).select(
  // //       'username firstName lastName email kycStatus kycDocuments createdAt'
  // //     );

  // //     if (!user) {
  // //       return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
  // //     }

  // //     res.json({
  // //       user: {
  // //         id: user._id,
  // //         username: user.username,
  // //         firstName: user.firstName,
  // //         lastName: user.lastName,
  // //         email: user.email,
  // //         createdAt: user.createdAt,
  // //       },
  // //       kycStatus: user.kycStatus,
  // //       documents: {
  // //         idFront: user.kycDocuments?.idFront
  // //           ? getFileUrl(user.kycDocuments.idFront)
  // //           : null,
  // //         idBack: user.kycDocuments?.idBack
  // //           ? getFileUrl(user.kycDocuments.idBack)
  // //           : null,
  // //         addressProof: user.kycDocuments?.addressProof
  // //           ? getFileUrl(user.kycDocuments.addressProof)
  // //           : null,
  // //       },
  // //     });
  // //   } catch (error) {
  // //     res.status(500).json({ message: error.message });
  // //   }
  // // };
  // const User = require('../models/User.model');
  // const { getFileUrl, deleteFile } = require('../utils/upload');

  // // -------------------------------------------
  // // User: Submit KYC (non-file data)
  // // -------------------------------------------
  // exports.submitKYC = async (req, res) => {
  //   try {
  //     const user = await User.findById(req.user.id);
  //     if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });

  //     // Optional: only mark pending if documents exist
  //     if (!user.kycDocuments?.idFront && !user.kycDocuments?.idBack && !user.kycDocuments?.addressProof) {
  //       return res.status(400).json({ message: 'Lütfen en az bir KYC belgesi yükleyin' });
  //     }

  //     user.kycStatus = 'pending';
  //     await user.save();

  //     res.json({ message: 'KYC gönderildi', kycStatus: user.kycStatus });
  //   } catch (error) {
  //     res.status(500).json({ message: error.message });
  //   }
  // };

  // // -------------------------------------------
  // // User: Upload KYC documents (FILES)
  // // -------------------------------------------
  // exports.uploadKYCDocuments = async (req, res) => {
  //   try {
  //     if (!req.files || Object.keys(req.files).length === 0)
  //       return res.status(400).json({ message: 'Lütfen en az bir dosya yükleyin' });

  //     const user = await User.findById(req.user.id);
  //     if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });

  //     // ID Front
  //     if (req.files.idFront?.[0]) {
  //       if (user.kycDocuments?.idFront) deleteFile(user.kycDocuments.idFront);
  //       user.kycDocuments.idFront = req.files.idFront[0].filename;
  //     }

  //     // ID Back
  //     if (req.files.idBack?.[0]) {
  //       if (user.kycDocuments?.idBack) deleteFile(user.kycDocuments.idBack);
  //       user.kycDocuments.idBack = req.files.idBack[0].filename;
  //     }

  //     // Address Proof
  //     if (req.files.addressProof?.[0]) {
  //       if (user.kycDocuments?.addressProof) deleteFile(user.kycDocuments.addressProof);
  //       user.kycDocuments.addressProof = req.files.addressProof[0].filename;
  //     }

  //     user.kycStatus = 'pending';
  //     await user.save();

  //     res.json({
  //       message: 'KYC belgeleri başarıyla yüklendi',
  //       kycStatus: user.kycStatus,
  //       documents: {
  //         idFront: user.kycDocuments?.idFront ? getFileUrl(user.kycDocuments.idFront) : null,
  //         idBack: user.kycDocuments?.idBack ? getFileUrl(user.kycDocuments.idBack) : null,
  //         addressProof: user.kycDocuments?.addressProof ? getFileUrl(user.kycDocuments.addressProof) : null,
  //       },
  //     });
  //   } catch (error) {
  //     res.status(500).json({ message: error.message });
  //   }
  // };

  // // -------------------------------------------
  // // User: Get KYC status & documents
  // // -------------------------------------------
  // exports.getKYC = async (req, res) => {
  //   try {
  //     const user = await User.findById(req.user.id).select('kycStatus kycDocuments');
  //     if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });

  //     res.json({
  //       kycStatus: user.kycStatus,
  //       documents: {
  //         idFront: user.kycDocuments?.idFront ? getFileUrl(user.kycDocuments.idFront) : null,
  //         idBack: user.kycDocuments?.idBack ? getFileUrl(user.kycDocuments.idBack) : null,
  //         addressProof: user.kycDocuments?.addressProof ? getFileUrl(user.kycDocuments.addressProof) : null,
  //       },
  //     });
  //   } catch (error) {
  //     res.status(500).json({ message: error.message });
  //   }
  // };

  // // -------------------------------------------
  // // Admin: Get KYC details of any user
  // // -------------------------------------------
  // exports.getKYCForAdmin = async (req, res) => {
  //   try {
  //     const user = await User.findById(req.params.userId).select(
  //       'username firstName lastName email kycStatus kycDocuments createdAt'
  //     );

  //     if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });

  //     res.json({
  //       user: {
  //         id: user._id,
  //         username: user.username,
  //         firstName: user.firstName,
  //         lastName: user.lastName,
  //         email: user.email,
  //         createdAt: user.createdAt,
  //       },
  //       kycStatus: user.kycStatus,
  //       documents: {
  //         idFront: user.kycDocuments?.idFront ? getFileUrl(user.kycDocuments.idFront) : null,
  //         idBack: user.kycDocuments?.idBack ? getFileUrl(user.kycDocuments.idBack) : null,
  //         addressProof: user.kycDocuments?.addressProof ? getFileUrl(user.kycDocuments.addressProof) : null,
  //       },
  //     });
  //   } catch (error) {
  //     res.status(500).json({ message: error.message });
  //   }
  // };

  // // -------------------------------------------
  // // Admin: Approve / Reject KYC
  // // -------------------------------------------
  // exports.updateKYCStatus = async (req, res) => {
  //   try {
  //     const { userId } = req.params;
  //     const { status } = req.body; // 'verified' or 'rejected'

  //     if (!['verified', 'rejected'].includes(status))
  //       return res.status(400).json({ message: 'Geçersiz KYC durumu' });

  //     const user = await User.findById(userId);
  //     if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });

  //     user.kycStatus = status;
  //     await user.save();

  //     res.json({ message: `KYC ${status} olarak güncellendi`, kycStatus: user.kycStatus });
  //   } catch (error) {
  //     res.status(500).json({ message: error.message });
  //   }
  // };
  // // controllers/kyc.controller.js
  // exports.getAllKYCForAdmin = async (req, res) => {
  //   try {
  //     const users = await User.find()
  //       .select('username email kycStatus kycDocuments createdAt') // select necessary fields
  //       .sort({ createdAt: -1 });

  //     const kycList = users.map(user => ({
  //       _id: user._id,
  //       status: user.kycStatus || 'pending',
  //       user: {
  //         _id: user._id,
  //         username: user.username,
  //         email: user.email,
  //       },
  //       documents: [
  //         user.kycDocuments?.idFront ? { url: getFileUrl(user.kycDocuments.idFront) } : null,
  //         user.kycDocuments?.idBack ? { url: getFileUrl(user.kycDocuments.idBack) } : null,
  //         user.kycDocuments?.addressProof ? { url: getFileUrl(user.kycDocuments.addressProof) } : null,
  //       ].filter(Boolean),
  //     }));

  //     res.json(kycList);
  //   } catch (error) {
  //     res.status(500).json({ message: error.message });
  //   }
  // };
  const User = require('../models/User.model');
  const { getFileUrl, deleteFile } = require('../utils/upload');

  // -------------------------------------------
  // User: Submit KYC (non-file data)
  // -------------------------------------------
  exports.submitKYC = async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });

      if (!user.kycDocuments?.idFront && !user.kycDocuments?.idBack && !user.kycDocuments?.addressProof) {
        return res.status(400).json({ message: 'Lütfen en az bir KYC belgesi yükleyin' });
      }

      user.kycStatus = 'pending';
      await user.save();

      res.json({ message: 'KYC gönderildi', kycStatus: user.kycStatus });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

  // -------------------------------------------
  // User: Upload KYC documents (FILES)
  // -------------------------------------------
  exports.uploadKYCDocuments = async (req, res) => {
    try {
      if (!req.files || Object.keys(req.files).length === 0)
        return res.status(400).json({ message: 'Lütfen en az bir dosya yükleyin' });

      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });

      // ID Front
      if (req.files.idFront?.[0]) {
        if (user.kycDocuments?.idFront) deleteFile(user.kycDocuments.idFront);
        user.kycDocuments.idFront = req.files.idFront[0].filename;
      }

      // ID Back
      if (req.files.idBack?.[0]) {
        if (user.kycDocuments?.idBack) deleteFile(user.kycDocuments.idBack);
        user.kycDocuments.idBack = req.files.idBack[0].filename;
      }

      // Address Proof
      if (req.files.addressProof?.[0]) {
        if (user.kycDocuments?.addressProof) deleteFile(user.kycDocuments.addressProof);
        user.kycDocuments.addressProof = req.files.addressProof[0].filename;
      }

      user.kycStatus = 'pending';
      await user.save();

      res.json({
        message: 'KYC belgeleri başarıyla yüklendi',
        kycStatus: user.kycStatus,
        documents: {
          idFront: user.kycDocuments?.idFront ? getFileUrl(user.kycDocuments.idFront) : null,
          idBack: user.kycDocuments?.idBack ? getFileUrl(user.kycDocuments.idBack) : null,
          addressProof: user.kycDocuments?.addressProof ? getFileUrl(user.kycDocuments.addressProof) : null,
        },
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

  // -------------------------------------------
  // User: Get KYC status & documents
  // -------------------------------------------
  exports.getKYC = async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select('kycStatus kycDocuments');
      if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });

      res.json({
        kycStatus: user.kycStatus,
        documents: {
          idFront: user.kycDocuments?.idFront ? getFileUrl(user.kycDocuments.idFront) : null,
          idBack: user.kycDocuments?.idBack ? getFileUrl(user.kycDocuments.idBack) : null,
          addressProof: user.kycDocuments?.addressProof ? getFileUrl(user.kycDocuments.addressProof) : null,
        },
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

  // -------------------------------------------
  // Admin: Get KYC details of any user
  // -------------------------------------------
  exports.getKYCForAdmin = async (req, res) => {
    try {
      const user = await User.findById(req.params.userId).select(
        'username firstName lastName email kycStatus kycDocuments createdAt'
      );
      if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });

      res.json({
        user: {
          id: user._id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          createdAt: user.createdAt,
        },
        kycStatus: user.kycStatus,
        documents: {
          idFront: user.kycDocuments?.idFront ? getFileUrl(user.kycDocuments.idFront) : null,
          idBack: user.kycDocuments?.idBack ? getFileUrl(user.kycDocuments.idBack) : null,
          addressProof: user.kycDocuments?.addressProof ? getFileUrl(user.kycDocuments.addressProof) : null,
        },
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

  // -------------------------------------------
  // Admin: Approve / Reject KYC
  // -------------------------------------------
  exports.updateKYCStatus = async (req, res) => {
    try {
      const { userId } = req.params;
      const { status } = req.body; // 'approved' or 'rejected'

      const VALID_STATUS = ['approved', 'rejected'];
      if (!VALID_STATUS.includes(status)) return res.status(400).json({ message: 'Geçersiz KYC durumu' });

      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });

      user.kycStatus = status;
      await user.save();

      res.json({ message: `KYC ${status} olarak güncellendi`, kycStatus: user.kycStatus });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

  // -------------------------------------------
  // Admin: Get all KYC submissions
  // -------------------------------------------
  exports.getAllKYCForAdmin = async (req, res) => {
    try {
      const users = await User.find()
        .select('username email kycStatus kycDocuments createdAt')
        .sort({ createdAt: -1 });

      const kycList = users.map(user => ({
        _id: user._id,
        status: user.kycStatus || 'pending',
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
        },
        documents: [
          user.kycDocuments?.idFront ? { url: getFileUrl(user.kycDocuments.idFront) } : null,
          user.kycDocuments?.idBack ? { url: getFileUrl(user.kycDocuments.idBack) } : null,
          user.kycDocuments?.addressProof ? { url: getFileUrl(user.kycDocuments.addressProof) } : null,
        ].filter(Boolean),
      }));

      res.json(kycList);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
  