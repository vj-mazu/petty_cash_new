const { SystemSettings } = require('../models');

// Get system setting by key
const getSetting = async (req, res) => {
  try {
    const { key } = req.params;
    
    const setting = await SystemSettings.findOne({
      where: {
        settingKey: key,
        isActive: true
      }
    });

    if (!setting) {
      return res.status(404).json({
        success: false,
        message: 'Setting not found'
      });
    }

    // Parse value based on data type
    let parsedValue = setting.settingValue;
    if (setting.dataType === 'number') {
      parsedValue = parseFloat(parsedValue);
    } else if (setting.dataType === 'boolean') {
      parsedValue = parsedValue === 'true';
    } else if (setting.dataType === 'json') {
      parsedValue = JSON.parse(parsedValue);
    }

    res.json({
      success: true,
      data: {
        key: setting.settingKey,
        value: parsedValue,
        dataType: setting.dataType,
        description: setting.description
      }
    });
  } catch (error) {
    console.error('Error getting setting:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Set or update system setting
const setSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value, dataType = 'string', description } = req.body;
    const userId = req.user.id;

    // Validate value based on data type
    let stringValue = value;
    if (dataType === 'number' && isNaN(value)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid number value'
      });
    } else if (dataType === 'json') {
      try {
        JSON.parse(value);
        stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: 'Invalid JSON value'
        });
      }
    } else {
      stringValue = String(value);
    }

    const [setting, created] = await SystemSettings.upsert({
      settingKey: key,
      settingValue: stringValue,
      dataType,
      description,
      createdBy: userId,
      updatedBy: userId,
      isActive: true
    }, {
      returning: true
    });

    res.json({
      success: true,
      message: created ? 'Setting created successfully' : 'Setting updated successfully',
      data: {
        key: setting.settingKey,
        value: dataType === 'number' ? parseFloat(stringValue) : 
               dataType === 'boolean' ? stringValue === 'true' :
               dataType === 'json' ? JSON.parse(stringValue) : stringValue,
        dataType: setting.dataType,
        description: setting.description
      }
    });
  } catch (error) {
    console.error('Error setting value:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get all system settings
const getAllSettings = async (req, res) => {
  try {
    const settings = await SystemSettings.findAll({
      where: {
        isActive: true
      },
      order: [['settingKey', 'ASC']]
    });

    const formattedSettings = settings.map(setting => {
      let parsedValue = setting.settingValue;
      if (setting.dataType === 'number') {
        parsedValue = parseFloat(parsedValue);
      } else if (setting.dataType === 'boolean') {
        parsedValue = parsedValue === 'true';
      } else if (setting.dataType === 'json') {
        parsedValue = JSON.parse(parsedValue);
      }

      return {
        key: setting.settingKey,
        value: parsedValue,
        dataType: setting.dataType,
        description: setting.description,
        updatedAt: setting.updatedAt
      };
    });

    res.json({
      success: true,
      data: {
        settings: formattedSettings
      }
    });
  } catch (error) {
    console.error('Error getting all settings:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getSetting,
  setSetting,
  getAllSettings
};