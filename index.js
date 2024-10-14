const TelegramBot = require('node-telegram-bot-api');
const ytSearch = require('yt-search');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');

// Replace with your bot's token from BotFather
const token = '7693858286:AAGcEoeoQ2yzFXSot7_MCaADTBRxngtbHqw';

// Create a new bot instance
const bot = new TelegramBot(token, { polling: true });

// Listen for messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const query = msg.text;

  // If message is not a command, treat it as a video search query
  if (query) {
    try {
      const searchMessage = await bot.sendMessage(chatId, `Searching for "${query}" on YouTube...`);

      // Search for the video
      const searchResults = await ytSearch(query);
      const video = searchResults.videos.length ? searchResults.videos[0] : null;

      if (video) {
        // Remove the search message and the found message after sending the video
        const foundMessage = await bot.sendMessage(chatId, `Found: ${video.title}\nDownloading...`);

        // Download the video using ytdl-core
        const stream = ytdl(video.url, { filter: 'audioandvideo' });
        const filePath = `${video.title}.mp4`;
        const writeStream = fs.createWriteStream(filePath);

        stream.pipe(writeStream);

        writeStream.on('finish', async () => {
          // Send the video file to the user
          await bot.sendVideo(chatId, filePath, {}, { filename: filePath }).then(async () => {
            // Remove both messages after sending the video
            await bot.deleteMessage(chatId, searchMessage.message_id);
            await bot.deleteMessage(chatId, foundMessage.message_id);

            // Send a message with buttons after the video is sent
            const buttons = [
              [
                {
                  text: 'Send Audio',
                  callback_data: `send_audio_${video.url}`
                },
                {
                  text: 'Show Lyrics',
                  callback_data: `show_lyrics_${video.url}`
                }
              ]
            ];
            await bot.sendMessage(chatId, 'What would you like to do next?', {
              reply_markup: {
                inline_keyboard: buttons
              }
            });

            // Delete the video file after sending
            fs.unlinkSync(filePath);
          }).catch((err) => {
            bot.sendMessage(chatId, 'Failed to send video.');
            console.error(err);
          });
        });

      } else {
        await bot.deleteMessage(chatId, searchMessage.message_id);
        bot.sendMessage(chatId, `No results found for "${query}".`);
      }
    } catch (error) {
      bot.sendMessage(chatId, 'An error occurred while searching or downloading the video.');
      console.error(error);
    }
  }
});

// Handle callback queries for buttons
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data.split('_');

  if (data[0] === 'send_audio') {
    const videoUrl = data[1];
    const audioStream = ytdl(videoUrl, { filter: 'audioonly' });
    const audioFilePath = `audio_${Date.now()}.mp3`;
    const writeStream = fs.createWriteStream(audioFilePath);

    audioStream.pipe(writeStream);

    writeStream.on('finish', async () => {
      await bot.sendAudio(chatId, audioFilePath);
      fs.unlinkSync(audioFilePath); // Delete the audio file after sending
    });
  } else if (data[0] === 'show_lyrics') {
    // For demonstration purposes, we'll just send a placeholder for lyrics.
    // In a real implementation, you'd fetch lyrics from a lyrics API.
    await bot.sendMessage(chatId, 'Lyrics feature is under development. Stay tuned!');
  }
});