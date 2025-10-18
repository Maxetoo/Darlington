const setupWebSocketEvents = (io) => {
  io.on('connection', (socket) => {
    console.log('New user connected:', socket.id);

    socket.on('testing', (data) => {
      console.log('Received testing event with data:', data);
      socket.emit('testing_response', { message: 'Testing event received successfully!' });
    });
    
  });

  io.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
}

module.exports = setupWebSocketEvents;