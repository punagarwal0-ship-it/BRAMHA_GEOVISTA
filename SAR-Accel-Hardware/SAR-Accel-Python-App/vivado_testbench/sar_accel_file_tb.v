`timescale 1ns/1ps

// File-driven simulation harness for SAR-Accel.
// Place image1.mem and image2.mem in the simulator working directory. Pixels
// are one 8-bit hex value per line, row-major. RTL outputs are written as
// rtl_enhanced.mem and rtl_change.mem in the same directory.
module sar_accel_file_tb;
    parameter IMAGE_WIDTH = 16;
    parameter IMAGE_HEIGHT = 16;
    localparam INPUT_PIXELS = IMAGE_WIDTH * IMAGE_HEIGHT;
    localparam OUTPUT_PIXELS = (IMAGE_WIDTH - 2) * (IMAGE_HEIGHT - 2);

    reg clk = 1'b0;
    always #5 clk = ~clk;

    reg rst, start, valid_in, ready_out;
    reg [7:0] pixel1_in, pixel2_in, threshold;
    wire ready_in, busy, done, valid_out, change_pixel;
    wire [7:0] enhanced_pixel;

    reg [7:0] image1_mem [0:INPUT_PIXELS-1];
    reg [7:0] image2_mem [0:INPUT_PIXELS-1];
    reg [7:0] threshold_mem [0:0];
    integer enhanced_fd, change_fd;
    integer out_count, errors;
    integer k;

    sar_accel_top #(
        .IMAGE_WIDTH(IMAGE_WIDTH),
        .IMAGE_HEIGHT(IMAGE_HEIGHT),
        .COORD_WIDTH(16)
    ) dut (
        .clk(clk), .rst(rst), .start(start), .valid_in(valid_in),
        .ready_in(ready_in), .pixel1_in(pixel1_in), .pixel2_in(pixel2_in),
        .threshold(threshold), .busy(busy), .done(done),
        .valid_out(valid_out), .ready_out(ready_out),
        .enhanced_pixel(enhanced_pixel), .change_pixel(change_pixel)
    );

    // Capture only accepted output items. The two output files stay aligned.
    always @(posedge clk) begin
        if (!rst && valid_out && ready_out) begin
            $fdisplay(enhanced_fd, "%02X", enhanced_pixel);
            $fdisplay(change_fd, "%01X", change_pixel);
            out_count = out_count + 1;
        end
    end

    initial begin
        rst=1'b1; start=1'b0; valid_in=1'b0; ready_out=1'b1;
        pixel1_in=8'd0; pixel2_in=8'd0; threshold=8'd20;
        out_count=0; errors=0;

        $readmemh("image1.mem", image1_mem);
        $readmemh("image2.mem", image2_mem);
        $readmemh("threshold.mem", threshold_mem);
        threshold = threshold_mem[0];
        enhanced_fd = $fopen("rtl_enhanced.mem", "w");
        change_fd = $fopen("rtl_change.mem", "w");
        if (enhanced_fd == 0 || change_fd == 0) begin
            $display("FAIL: could not open RTL output files");
            $finish;
        end

        repeat (3) @(posedge clk);
        @(negedge clk); rst=1'b0; start=1'b1;
        @(posedge clk); #1; start=1'b0;

        // Stream paired images in row-major order. Hold each pixel pair until
        // the DUT accepts it, including the pause while an interior result drains.
        for (k=0; k<INPUT_PIXELS; k=k+1) begin
            @(negedge clk);
            valid_in=1'b1;
            pixel1_in=image1_mem[k];
            pixel2_in=image2_mem[k];
            while (ready_in !== 1'b1) @(negedge clk);
            @(posedge clk); #1;
        end
        @(negedge clk); valid_in=1'b0;

        wait (done === 1'b1);
        #1;
        if (out_count != OUTPUT_PIXELS) begin
            $display("FAIL: expected %0d output pixels, captured %0d",
                     OUTPUT_PIXELS, out_count);
            errors=errors+1;
        end
        $fclose(enhanced_fd);
        $fclose(change_fd);
        if (errors==0)
            $display("PASS: captured %0d interior output pixels", out_count);
        $finish;
    end

    initial begin
        if (IMAGE_WIDTH < 3 || IMAGE_HEIGHT < 3) begin
            $display("FAIL: IMAGE_WIDTH and IMAGE_HEIGHT must be at least 3");
            $finish;
        end
    end
endmodule
